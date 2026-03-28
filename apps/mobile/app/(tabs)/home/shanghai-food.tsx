import { ShanghaiPostListScreen } from "../../../src/features/home/shanghai-post-list-screen";

export default function ShanghaiFoodScreen() {
  return (
    <ShanghaiPostListScreen
      title="Food"
      returnFallback="/home/shanghai"
      subcategories={[
        { slug: "fun-food-cafe", label: "카페" },
        { slug: "fun-food-chinese", label: "중식" },
        { slug: "fun-food-western", label: "양식" },
        { slug: "fun-food-korean", label: "한식" },
        { slug: "fun-food-japanese", label: "일식" },
        { slug: "fun-food-other", label: "기타" }
      ]}
    />
  );
}
