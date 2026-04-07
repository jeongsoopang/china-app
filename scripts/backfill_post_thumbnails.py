#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote

import requests
from PIL import Image, ImageOps, UnidentifiedImageError

POST_IMAGES_BUCKET = "post-images"
DEFAULT_PAGE_SIZE = 100
DEFAULT_THUMB_MAX_LONG_EDGE = 640
DEFAULT_JPEG_QUALITY = 72
ONE_YEAR_CACHE_SECONDS = "31536000"

IMG_SRC_RE = re.compile(r'<img\\s+[^>]*src=["\\\']([^"\\\']+)["\\\']', re.IGNORECASE)


class BackfillError(Exception):
    pass


@dataclass
class PostRow:
    id: int
    author_id: Optional[str]
    body: str
    thumbnail_image_url: Optional[str]
    thumbnail_storage_path: Optional[str]


@dataclass
class ImageCandidate:
    source_url: str
    source_kind: str  # post_images | body_first_img


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
        data: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
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
            data=data,
            headers=merged_headers,
            timeout=timeout or self.timeout,
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
            "select": "id,author_id,body,thumbnail_image_url,thumbnail_storage_path",
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
                    thumbnail_image_url=row.get("thumbnail_image_url"),
                    thumbnail_storage_path=row.get("thumbnail_storage_path"),
                )
            )
        return mapped

    def fetch_post_images(self, post_id: int) -> List[Dict[str, Any]]:
        params = {
            "select": "image_url,sort_order",
            "post_id": f"eq.{post_id}",
            "order": "sort_order.asc.nullslast",
        }
        response = self._request("GET", "/rest/v1/post_images", params=params)
        if response.status_code >= 300:
            raise BackfillError(
                f"Failed to fetch post_images for post {post_id}: "
                f"{response.status_code} {response.text}"
            )
        rows = response.json()
        valid_rows = [
            row for row in rows
            if isinstance(row.get("image_url"), str) and row["image_url"].strip() != ""
        ]
        return valid_rows

    def update_post_thumbnail(
        self,
        *,
        post_id: int,
        thumbnail_image_url: str,
        thumbnail_storage_path: str,
    ) -> None:
        params = {"id": f"eq.{post_id}"}
        body = {
            "thumbnail_image_url": thumbnail_image_url,
            "thumbnail_storage_path": thumbnail_storage_path,
        }
        response = self._request(
            "PATCH",
            "/rest/v1/posts",
            params=params,
            json_body=body,
            headers={"Content-Type": "application/json"},
        )
        if response.status_code >= 300:
            raise BackfillError(
                f"Failed to update thumbnail metadata for post {post_id}: "
                f"{response.status_code} {response.text}"
            )

    def upload_thumbnail_bytes(
        self,
        *,
        storage_path: str,
        payload: bytes,
        content_type: str = "image/jpeg",
    ) -> str:
        encoded_path = quote(storage_path, safe="/")
        response = self._request(
            "POST",
            f"/storage/v1/object/{POST_IMAGES_BUCKET}/{encoded_path}",
            data=payload,
            headers={
                "Content-Type": content_type,
                "x-upsert": "false",
                "cache-control": ONE_YEAR_CACHE_SECONDS,
            },
            timeout=120,
        )
        if response.status_code >= 300:
            raise BackfillError(
                f"Failed to upload thumbnail {storage_path}: "
                f"{response.status_code} {response.text}"
            )

        public_url = (
            f"{self.base_url}/storage/v1/object/public/"
            f"{POST_IMAGES_BUCKET}/{encoded_path}"
        )
        return public_url


def extract_first_body_image_url(body: str) -> Optional[str]:
    if not body:
        return None
    match = IMG_SRC_RE.search(body)
    if not match:
        return None
    value = match.group(1).strip()
    return value or None


def choose_candidate(client: SupabaseRestClient, post: PostRow) -> Optional[ImageCandidate]:
    post_images = client.fetch_post_images(post.id)
    if post_images:
        return ImageCandidate(
            source_url=post_images[0]["image_url"].strip(),
            source_kind="post_images",
        )

    body_url = extract_first_body_image_url(post.body)
    if body_url:
        return ImageCandidate(source_url=body_url, source_kind="body_first_img")

    return None


def download_source_image(url: str) -> bytes:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return response.content


def create_thumbnail_jpeg(
    source_bytes: bytes,
    *,
    max_long_edge: int,
    jpeg_quality: int,
) -> bytes:
    try:
        with Image.open(io.BytesIO(source_bytes)) as image:
            image = ImageOps.exif_transpose(image)

            if image.mode in ("RGBA", "LA"):
                background = Image.new("RGB", image.size, (255, 255, 255))
                background.paste(image, mask=image.getchannel("A"))
                image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")

            image.thumbnail((max_long_edge, max_long_edge), Image.Resampling.LANCZOS)

            output = io.BytesIO()
            image.save(
                output,
                format="JPEG",
                quality=jpeg_quality,
                optimize=True,
                progressive=True,
            )
            return output.getvalue()
    except UnidentifiedImageError as exc:
        raise BackfillError(f"Unsupported or invalid source image format: {exc}") from exc


def make_storage_path(post_id: int) -> str:
    timestamp = int(time.time() * 1000)
    return f"backfill-thumbnails/{post_id}/{timestamp}-thumb.jpg"


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
        description="Backfill thumbnail_image_url / thumbnail_storage_path for existing posts."
    )
    parser.add_argument("--apply", action="store_true", help="Actually upload and update metadata.")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N missing-thumbnail posts.")
    parser.add_argument("--post-id", type=int, default=None, help="Only process a specific post ID.")
    parser.add_argument("--author-id", type=str, default=None, help="Only process posts by one author ID.")
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE, help="REST page size.")
    parser.add_argument(
        "--max-long-edge",
        type=int,
        default=DEFAULT_THUMB_MAX_LONG_EDGE,
        help="Thumbnail max long edge in pixels.",
    )
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=DEFAULT_JPEG_QUALITY,
        help="Thumbnail JPEG quality (1-95).",
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
        "already_had_thumbnail": 0,
        "missing_thumbnail_candidates": 0,
        "skipped_no_source_image": 0,
        "would_generate": 0,
        "generated": 0,
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

        if not is_blank(post.thumbnail_image_url):
            stats["already_had_thumbnail"] += 1
            continue

        stats["missing_thumbnail_candidates"] += 1

        if args.limit is not None and processed_missing >= args.limit:
            break

        try:
            candidate = choose_candidate(client, post)
            if not candidate:
                stats["skipped_no_source_image"] += 1
                log(f"[skip:no-source] post={post.id}")
                processed_missing += 1
                continue

            if not args.apply:
                stats["would_generate"] += 1
                processed_missing += 1
                log(
                    f"[dry-run] post={post.id} source={candidate.source_kind} url={candidate.source_url}"
                )
                continue

            source_bytes = download_source_image(candidate.source_url)
            thumb_bytes = create_thumbnail_jpeg(
                source_bytes,
                max_long_edge=args.max_long_edge,
                jpeg_quality=args.jpeg_quality,
            )
            storage_path = make_storage_path(post.id)
            public_url = client.upload_thumbnail_bytes(
                storage_path=storage_path,
                payload=thumb_bytes,
                content_type="image/jpeg",
            )
            client.update_post_thumbnail(
                post_id=post.id,
                thumbnail_image_url=public_url,
                thumbnail_storage_path=storage_path,
            )
            stats["generated"] += 1
            processed_missing += 1
            log(
                f"[ok] post={post.id} source={candidate.source_kind} "
                f"bytes={len(thumb_bytes)} path={storage_path}"
            )
        except Exception as exc:  # noqa: BLE001
            stats["failed"] += 1
            processed_missing += 1
            log(f"[fail] post={post.id} error={exc}")

    log("")
    log("=== backfill summary ===")
    log(json.dumps(stats, indent=2))
    log(f"mode={'APPLY' if args.apply else 'DRY_RUN'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
