import { ShanghaiCategoryScreen } from "../../../src/features/home/shanghai-category-screen";

export default function ShanghaiLandmarkScreen() {
  return (
    <ShanghaiCategoryScreen
      title="명소"
      withRankedPosts
      returnFallback="/home/shanghai"
      sectionCode="fun"
      categorySlugs={["fun-travel"]}
    />
  );
}
