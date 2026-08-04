import { angular } from "@codemirror/lang-angular";
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { less } from "@codemirror/lang-less";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sass } from "@codemirror/lang-sass";
import { sql } from "@codemirror/lang-sql";
import { vue } from "@codemirror/lang-vue";
import { wast } from "@codemirror/lang-wast";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import {
  ceylon,
  csharp,
  dart,
  kotlin,
  objectiveC,
  objectiveCpp,
  scala,
} from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { cypher } from "@codemirror/legacy-modes/mode/cypher";
import { d as dlang } from "@codemirror/legacy-modes/mode/d";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { elm } from "@codemirror/legacy-modes/mode/elm";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { fortran } from "@codemirror/legacy-modes/mode/fortran";
import { gas } from "@codemirror/legacy-modes/mode/gas";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { fSharp, oCaml, sml } from "@codemirror/legacy-modes/mode/mllike";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { octave } from "@codemirror/legacy-modes/mode/octave";
import { pascal } from "@codemirror/legacy-modes/mode/pascal";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { smalltalk } from "@codemirror/legacy-modes/mode/smalltalk";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { tcl } from "@codemirror/legacy-modes/mode/tcl";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { vb } from "@codemirror/legacy-modes/mode/vb";
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { webIDL } from "@codemirror/legacy-modes/mode/webidl";
import type { Extension } from "@codemirror/state";

export function languageFor(path: string): Extension | undefined {
  const name = path.toLowerCase();
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : base;

  if (base === "dockerfile" || base.endsWith(".dockerfile")) {
    return StreamLanguage.define(dockerFile);
  }
  if (base === "cmakelists.txt" || base.endsWith(".cmake")) {
    return StreamLanguage.define(cmake);
  }
  if (base === "nginx.conf" || base.endsWith(".nginx")) {
    return StreamLanguage.define(nginx);
  }

  switch (ext) {
    case ".js":
    case ".mjs":
    case ".cjs":
      return javascript();
    case ".jsx":
      return javascript({ jsx: true });
    case ".ts":
    case ".mts":
    case ".cts":
      return javascript({ typescript: true });
    case ".tsx":
      return javascript({ jsx: true, typescript: true });
    case ".json":
    case ".jsonc":
      return json();
    case ".html":
    case ".htm":
      return html();
    case ".vue":
      return vue();
    case ".svelte":
      return html();
    case ".component.html":
      return angular();
    case ".css":
      return css();
    case ".scss":
      return sass({ indented: false });
    case ".sass":
      return sass({ indented: true });
    case ".less":
      return less();
    case ".md":
    case ".markdown":
      return markdown();
    case ".py":
    case ".pyw":
      return python();
    case ".rs":
      return rust();
    case ".go":
      return go();
    case ".c":
    case ".h":
    case ".cpp":
    case ".hpp":
    case ".cc":
    case ".cxx":
    case ".hh":
    case ".c++":
    case ".h++":
      return cpp();
    case ".java":
      return java();
    case ".php":
    case ".phtml":
      return php();
    case ".sql":
      return sql();
    case ".xml":
    case ".svg":
    case ".plist":
    case ".xsd":
      return xml();
    case ".yaml":
    case ".yml":
      return yaml();
    case ".sh":
    case ".bash":
    case ".zsh":
    case ".fish":
      return StreamLanguage.define(shell);
    case ".rb":
      return StreamLanguage.define(ruby);
    case ".ps1":
    case ".psm1":
      return StreamLanguage.define(powerShell);
    case ".toml":
      return StreamLanguage.define(toml);
    case ".ini":
    case ".cfg":
    case ".conf":
    case ".env":
    case ".gitattributes":
    case ".gitignore":
      return StreamLanguage.define(properties);
    case ".lua":
      return StreamLanguage.define(lua);
    case ".swift":
      return StreamLanguage.define(swift);
    case ".r":
      return StreamLanguage.define(r);
    case ".erl":
    case ".hrl":
      return StreamLanguage.define(erlang);
    case ".hs":
    case ".lhs":
      return StreamLanguage.define(haskell);
    case ".clj":
    case ".cljs":
    case ".cljc":
      return StreamLanguage.define(clojure);
    case ".jl":
      return StreamLanguage.define(julia);
    case ".pl":
    case ".pm":
      return StreamLanguage.define(perl);
    case ".diff":
    case ".patch":
      return StreamLanguage.define(diff);
    case ".gradle":
    case ".groovy":
      return StreamLanguage.define(groovy);
    case ".oct":
    case ".mat":
      return StreamLanguage.define(octave);
    case ".tex":
      return StreamLanguage.define(stex);
    case ".f":
    case ".for":
    case ".f90":
    case ".f95":
      return StreamLanguage.define(fortran);
    case ".pas":
    case ".pp":
    case ".dpr":
      return StreamLanguage.define(pascal);
    case ".scm":
    case ".ss":
    case ".rkt":
    case ".sld":
      return StreamLanguage.define(scheme);
    case ".v":
      return StreamLanguage.define(verilog);
    case ".vhd":
    case ".vhdl":
      return StreamLanguage.define(vhdl);
    case ".elm":
      return StreamLanguage.define(elm);
    case ".vb":
    case ".vbs":
    case ".bas":
      return StreamLanguage.define(vb);
    case ".tcl":
      return StreamLanguage.define(tcl);
    case ".s":
    case ".asm":
      return StreamLanguage.define(gas);
    case ".st":
      return StreamLanguage.define(smalltalk);
    case ".ml":
    case ".mli":
      return StreamLanguage.define(oCaml);
    case ".fs":
    case ".fsi":
    case ".fsx":
      return StreamLanguage.define(fSharp);
    case ".sml":
      return StreamLanguage.define(sml);
    case ".d":
      return StreamLanguage.define(dlang);
    case ".cypher":
    case ".cql":
      return StreamLanguage.define(cypher);
    case ".webidl":
    case ".idl":
      return StreamLanguage.define(webIDL);
    case ".wat":
      return wast();
    case ".scala":
    case ".sc":
      return StreamLanguage.define(scala);
    case ".kt":
    case ".kts":
      return StreamLanguage.define(kotlin);
    case ".cs":
    case ".csx":
      return StreamLanguage.define(csharp);
    case ".dart":
      return StreamLanguage.define(dart);
    case ".m":
      return StreamLanguage.define(objectiveC);
    case ".mm":
      return StreamLanguage.define(objectiveCpp);
    case ".ceylon":
      return StreamLanguage.define(ceylon);
    default:
      return undefined;
  }
}
