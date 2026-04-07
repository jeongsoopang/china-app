#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import requests

DEFAULT_PAGE_SIZE = 100
DEFAULT_ABSTRACT_MAX_LENGTH = 140

IMG_TAG_RE = re.compile(r"<img\\s+[^>]*>", re.IGNORECASE)
P_TAG_RE = re.compile(r"</?p[^>]*>", re.IGNORECASE)
BR_TAG_RE = re.compile(r"<br\\s*/?>", re.IGNORECASE)
ANY_TAG_RE = re.compile(r"<[^>]+>", re.IGNORECASE)
WHITESPACE_RE = re.compile(r"\\s+")


class BackfillError(Exception):
    pass


@dataclass
class PostRow:
    id: int
    author_id: Optional[str]
    body: str
    abstract: Optional[str]


def log(message: str) -> None:
    print(message, flush=True)


def is_blank(value: Optional[str]) -> bool:
    return value is None or value.strip() == ""


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value or value.strip() == "":
        raise BackfillError(f"Missing required environment variable: {name}")
    return value.strip()


class SupabaseRestClient:
    def __init__(self, base_url: str, service_role_key: str, timeout: int = 60) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout = timeout
        self.session = requests.Session()
        self.base_headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        url = f"{self.base_url}{path}"
        merged_headers = dict(self.base_headers)
        if headers:
            merged_headers.update(headers)

        response = self.session.request(
            method=method,
            url=url,
            params=params,
            json=json_body,
            headers=merged_headers,
            timeout=self.timeout,
        )
        return response

    def fetch_posts_page(
        self,
        *,
        offset: int,
        limit: int,
        post_id: Optional[int] = None,
        author_id: Optional[str] = None,
    ) -> List[PostRow]:
        params: Dict[str, Any] = {
            "select": "id,author_id,body,abstract",
            "order": "id.asc",
            "offset": str(offset),
            "limit": str(limit),
        }
        if post_id is not None:
            params["id"] = f"eq.{post_id}"
        if author_id:
            params["author_id"] = f"eq.{author_id}"

        response = self._request("GET", "/rest/v1/posts", params=params)
        if response.status_code >= 300:
            raise BackfillError(
                f"Failed to fetch posts page: {response.status_code} {response.text}"
            )

        rows = response.json()
        mapped: List[PostRow] = []
        for row in rows:
            mapped.append(
                PostRow(
                    id=int(row["id"]),
                    author_id=row.get("author_id"),
                    body=row.get("body") or "",
                    abstract=row.get("abstract"),
                )
            )
        return mapped

    def update_post_abstract(self, *, post_id: int, abstract: str) -> None:
        params = {"id": f"eq.{post_id}"}
        body = {"abstract": abstract}
        response = self._request(
            "PATCH",
            "/rest/v1/posts",
            params=params,
            json_body=body,
            headers={"Content-Type": "application/json"},
        )
        if response.status_code >= 300:
            raise BackfillError(
                f"Failed to update abstract for post {post_id}: "
                f"{response.status_code} {response.text}"
            )


def html_to_plain_text(body: str) -> str:
    if not body:
        return ""

    text = body
    text = IMG_TAG_RE.sub(" ", text)
    text = BR_TAG_RE.sub(" ", text)
    text = P_TAG_RE.sub(" ", text)
    text = ANY_TAG_RE.sub(" ", text)
    text = html.unescape(text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def build_abstract(body: str, max_length: int) -> Optional[str]:
    text = html_to_plain_text(body)
    if text == "":
        return None

    if len(text) <= max_length:
        return text

    clipped = text[: max_length + 1].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0].rstrip()

    if clipped == "":
        clipped = text[:max_length].rstrip()

    return f"{clipped}..."


def iter_posts(
    client: SupabaseRestClient,
    *,
    page_size: int,
    post_id: Optional[int],
    author_id: Optional[str],
) -> Iterable[PostRow]:
    offset = 0
    while True:
        page = client.fetch_posts_page(
            offset=offset,
            limit=page_size,
            post_id=post_id,
            author_id=author_id,
        )
        if not page:
            break
        for row in page:
            yield row
        if post_id is not None:
            break
        offset += page_size


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill posts.abstract for existing posts with missing abstracts."
    )
    parser.add_argument("--apply", action="store_true", help="Actually update abstracts.")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N missing-abstract posts.")
    parser.add_argument("--post-id", type=int, default=None, help="Only process a specific post ID.")
    parser.add_argument("--author-id", type=str, default=None, help="Only process posts by one author ID.")
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE, help="REST page size.")
    parser.add_argument(
        "--max-length",
        type=int,
        default=DEFAULT_ABSTRACT_MAX_LENGTH,
        help="Maximum abstract length before ellipsis.",
    )
    args = parser.parse_args()

    try:
        base_url = require_env("SUPABASE_URL")
        service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    except BackfillError as exc:
        log(f"[fatal] {exc}")
        return 1

    client = SupabaseRestClient(base_url, service_role_key)

    stats = {
        "scanned": 0,
        "already_had_abstract": 0,
        "missing_abstract_candidates": 0,
        "skipped_no_text": 0,
        "would_update": 0,
        "updated": 0,
        "failed": 0,
    }

    processed_missing = 0

    for post in iter_posts(
        client,
        page_size=args.page_size,
        post_id=args.post_id,
        author_id=args.author_id,
    ):
        stats["scanned"] += 1

        if not is_blank(post.abstract):
            stats["already_had_abstract"] += 1
            continue

        stats["missing_abstract_candidates"] += 1

        if args.limit is not None and processed_missing >= args.limit:
            break

        try:
            abstract = build_abstract(post.body, args.max_length)
            if not abstract:
                stats["skipped_no_text"] += 1
                processed_missing += 1
                log(f"[skip:no-text] post={post.id}")
                continue

            if not args.apply:
                stats["would_update"] += 1
                processed_missing += 1
                log(f"[dry-run] post={post.id} abstract={abstract!r}")
                continue

            client.update_post_abstract(post_id=post.id, abstract=abstract)
            stats["updated"] += 1
            processed_missing += 1
            log(f"[ok] post={post.id} abstract={abstract!r}")
        except Exception as exc:  # noqa: BLE001
            stats["failed"] += 1
            processed_missing += 1
            log(f"[fail] post={post.id} error={exc}")

    log("")
    log("=== abstract backfill summary ===")
    log(json.dumps(stats, indent=2))
    log(f"mode={'APPLY' if args.apply else 'DRY_RUN'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
