import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { supabase } from "../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type MyPost = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
};

type EditDraft = {
  id: number;
  title: string;
  body: string;
};

function stripBodyPreview(body: string): string {
  if (!body) {
    return "";
  }

  return body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function MyPostsScreen() {
  const auth = useAuthSession();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const authUserId = auth.user?.authUser.id ?? null;
  const resolvedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const safeReturnTo = resolvedReturnTo ?? "/me";
  const currentPageReturnTo = `/my-posts?returnTo=${encodeURIComponent(safeReturnTo)}`;

  const loadPosts = useCallback(async () => {
    setErrorMessage(null);
    setPosts([]);

    if (!authUserId) {
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select("id, title, body, created_at")
      .eq("author_id", authUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: number;
      title: string;
      body: string;
      created_at: string;
    }>;

    setPosts(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at
      }))
    );
    setIsLoading(false);
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  const isSignedIn = auth.isSignedIn && auth.user;

  const canSaveEdit = useMemo(() => {
    return Boolean(
      editDraft &&
        editDraft.title.trim().length > 0 &&
        editDraft.body.trim().length > 0 &&
        !isSavingEdit
    );
  }, [editDraft, isSavingEdit]);

  async function saveEdit() {
    if (!editDraft || !authUserId || !canSaveEdit) {
      return;
    }

    setErrorMessage(null);
    setIsSavingEdit(true);

    const { error } = await supabase
      .from("posts")
      .update({
        title: editDraft.title.trim(),
        body: editDraft.body.trim()
      })
      .eq("id", editDraft.id)
      .eq("author_id", authUserId);

    if (error) {
      setErrorMessage(error.message);
      setIsSavingEdit(false);
      return;
    }

    setEditDraft(null);
    setIsSavingEdit(false);
    await loadPosts();
  }

  async function deletePost(postId: number) {
    if (!authUserId || isDeleting !== null) {
      return;
    }

    setIsDeleting(postId);
    setErrorMessage(null);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", authUserId);

    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(null);
      return;
    }

    setIsDeleting(null);
    await loadPosts();
  }

  function confirmDelete(postId: number) {
    Alert.alert("글 삭제", "이 글을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          void deletePost(postId);
        }
      }
    ]);
  }

  if (auth.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>내가 쓴 글</Text>
        <Text style={styles.metaText}>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>내가 쓴 글</Text>
        <Text style={styles.metaText}>Sign in required.</Text>
        <Link asChild href="/auth/sign-in">
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>Sign In</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>내가 쓴 글</Text>

        {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {!isLoading && posts.length === 0 && !errorMessage ? (
          <Text style={styles.metaText}>작성한 글이 없습니다.</Text>
        ) : null}

        {posts.map((post) => {
          const preview = stripBodyPreview(post.body);
          const deleting = isDeleting === post.id;

          return (
            <View key={post.id} style={styles.postCard}>
              <Link
                asChild
                href={{
                  pathname: "/posts/[postId]",
                  params: {
                    postId: String(post.id),
                    returnTo: currentPageReturnTo
                  }
                }}
              >
                <Pressable>
                  <Text style={styles.postTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                  {preview ? (
                    <Text style={styles.postPreview} numberOfLines={3}>
                      {preview}
                    </Text>
                  ) : null}
                </Pressable>
              </Link>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setEditDraft({ id: post.id, title: post.title, body: post.body })}
                >
                  <Text style={styles.secondaryButtonLabel}>수정</Text>
                </Pressable>
                <Pressable
                  style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                  onPress={() => confirmDelete(post.id)}
                  disabled={deleting}
                >
                  <Text style={styles.deleteButtonLabel}>{deleting ? "삭제 중..." : "삭제"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(editDraft)} transparent animationType="fade" onRequestClose={() => setEditDraft(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditDraft(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>글 수정</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>제목</Text>
              <TextInput
                value={editDraft?.title ?? ""}
                onChangeText={(value) =>
                  setEditDraft((current) => (current ? { ...current, title: value } : current))
                }
                style={styles.fieldInput}
                placeholder="제목"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>내용</Text>
              <TextInput
                value={editDraft?.body ?? ""}
                onChangeText={(value) =>
                  setEditDraft((current) => (current ? { ...current, body: value } : current))
                }
                style={[styles.fieldInput, styles.bodyInput]}
                placeholder="내용"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditDraft(null)}>
                <Text style={styles.secondaryButtonLabel}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, !canSaveEdit && styles.buttonDisabled]}
                disabled={!canSaveEdit}
                onPress={() => {
                  void saveEdit();
                }}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isSavingEdit ? "저장 중..." : "저장"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  centeredContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  title: {
    fontSize: typography.titleLarge,
    fontWeight: "700",
    color: colors.textPrimary
  },
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  },
  postCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm
  },
  postTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postDate: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postPreview: {
    marginTop: 4,
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  primaryButtonLabel: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  secondaryButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  deleteButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#f2bcbc",
    backgroundColor: "#fff6f6",
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  deleteButtonLabel: {
    color: colors.error,
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  buttonDisabled: {
    opacity: 0.6
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.28)",
    justifyContent: "center",
    padding: spacing.lg
  },
  modalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md
  },
  modalTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.body,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bodyInput: {
    minHeight: 120
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm
  }
});
