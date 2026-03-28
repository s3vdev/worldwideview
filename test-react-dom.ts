import { renderToStaticMarkup } from "react-dom/server";
import { Atom } from "lucide-react";
import React from "react";
console.log(renderToStaticMarkup(React.createElement(Atom, { color: "#22d3ee", size: 24 })));
