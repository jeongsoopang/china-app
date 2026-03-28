import { ShanghaiPostListScreen } from "../../../src/features/home/shanghai-post-list-screen";

export default function ShanghaiPlaceScreen() {
  return (
    <ShanghaiPostListScreen
      title="Place"
      returnFallback="/home/shanghai"
      baseCategorySlugs={["fun-place"]}
    />
  );
}
