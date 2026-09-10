import { cn } from '../../utils/cn';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
  onPageReset?: () => void;
}

export const FilterSelect = ({ value, onChange, options, className, onPageReset }: FilterSelectProps) => {
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        onPageReset?.();
      }}
      className={cn(
        "px-4 py-2.5 dark:bg-dark-card border border-gray-200 dark:border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all text-gray-900 dark:text-white text-sm cursor-pointer min-w-[160px]",
        className
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
