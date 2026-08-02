import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

const OPTION_TOGGLES: {
  key: keyof SearchOptions;
  label: string;
  title: string;
}[] = [
  { key: "caseSensitive", label: "Aa", title: "Match Case" },
  { key: "wholeWord", label: "ab", title: "Match Whole Word" },
  { key: "regex", label: ".*", title: "Use Regular Expression" },
];

function OptionToggle({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-semibold transition-colors ${
        active
          ? "text-primary-400"
          : "text-dark-400 hover:text-white hover:bg-dark-700"
      }`}
    >
      {children}
    </button>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(label === "In files");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-dark-300 hover:text-white"
      >
        {open ? (
          <CaretDownIcon className="w-3 h-3" />
        ) : (
          <CaretRightIcon className="w-3 h-3" />
        )}
        {label}
      </button>
      {open && (
        <div className="flex items-center gap-0.5 mt-1">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            className="flex-1 min-w-0 h-7 bg-dark-950 border border-dark-700 focus:border-primary-500 rounded px-2 text-xs text-white placeholder:text-dark-500 outline-none"
          />
          {value && (
            <button
              type="button"
              title="Clear"
              aria-label={`Clear ${label}`}
              onClick={() => onChange("")}
              className="p-1 text-dark-500 hover:text-white"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function EditorSearch() {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [inFiles, setInFiles] = useState("");
  const [excludeFiles, setExcludeFiles] = useState("");
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  const toggleOption = (key: keyof SearchOptions) =>
    setOptions((o) => ({ ...o, [key]: !o[key] }));

  const runSearch = () => {
    if (!query.trim()) return;
    setShowResults(true);
  };

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 border-r border-dark-800 min-h-0">
      {/* Panel header */}
      <div className="flex items-center gap-1.5 pl-3 pr-2 h-8 border-b border-dark-800 shrink-0">
        <MagnifyingGlassIcon
          className="w-3.5 h-3.5 text-dark-400"
          weight="bold"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-300">
          Search
        </span>
      </div>

      {/* Search inputs */}
      <div className="px-2 py-2 space-y-1.5 shrink-0 min-w-0">
        <div className="flex items-center gap-0.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="Search across files"
            aria-label="Search code"
            className="flex-1 min-w-0 h-7 bg-dark-950 border border-dark-700 focus:border-primary-500 rounded px-2 text-xs text-white placeholder:text-dark-500 outline-none"
          />
          {query && (
            <button
              type="button"
              title="Clear search"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="p-1 text-dark-500 hover:text-white"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {OPTION_TOGGLES.map(({ key, label, title }) => (
            <OptionToggle
              key={key}
              active={options[key]}
              title={title}
              onClick={() => toggleOption(key)}
            >
              {label}
            </OptionToggle>
          ))}
        </div>

        {/* Replace row */}
        <div className="flex items-center gap-0.5 ml-4">
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with"
            aria-label="Replace text"
            disabled={!showReplace}
            className={`flex-1 min-w-0 h-7 bg-dark-950 border border-dark-700 focus:border-primary-500 rounded px-2 text-xs text-white placeholder:text-dark-500 outline-none ${
              showReplace ? "" : "opacity-50"
            }`}
          />
          <button
            type="button"
            title="Toggle Replace"
            aria-pressed={showReplace}
            onClick={() => setShowReplace((v) => !v)}
            className="p-1 text-dark-500 hover:text-white"
          >
            <ArrowsDownUpIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-0.5">
          <span className="flex-1" />
          <button
            type="button"
            title="Search filters"
            aria-pressed={showFilter}
            onClick={() => setShowFilter((v) => !v)}
            className={`p-1 rounded transition-colors ${
              showFilter
                ? "text-primary-400 bg-dark-700"
                : "text-dark-400 hover:text-white hover:bg-dark-700"
            }`}
          >
            <SlidersHorizontalIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {showFilter && (
          <div className="flex flex-col gap-1.5 border-t border-dark-800 pt-1.5">
            <FilterInput
              label="In files"
              value={inFiles}
              onChange={setInFiles}
              placeholder="*.tsx, !node_modules/**"
            />
            <FilterInput
              label="Files to exclude"
              value={excludeFiles}
              onChange={setExcludeFiles}
              placeholder="`out` folder, *.spec.ts"
            />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0 text-xs">
        {showResults ? (
          <div className="px-3 py-2 text-dark-500">
            Code search ships in a later phase &mdash; this is the UI shell for
            global search across the workspace.
          </div>
        ) : (
          <div className="px-3 py-2 text-dark-500">
            Type a query and press Enter to search across your workspace.
          </div>
        )}
      </div>
    </div>
  );
}
