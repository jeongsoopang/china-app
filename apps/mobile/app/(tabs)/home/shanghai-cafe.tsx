import { ShanghaiCategoryScreen } from "../../../src/features/home/shanghai-category-screen";

export default function ShanghaiCafeScreen() {
  return (
    <ShanghaiCategoryScreen
      title="Cafe"
      withRankedPosts
      returnFallback="/home/shanghai"
      sectionCode="fun"
      categorySlugs={["fun-cafe"]}
    />
  );
}
