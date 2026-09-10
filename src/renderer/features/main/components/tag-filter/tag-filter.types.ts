export interface TagFilterProps {
  tags: string[];
  onRemove: (tag: string) => void;
  onClear: () => void;
}
