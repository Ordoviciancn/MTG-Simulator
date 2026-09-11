import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ArenaClient } from './ArenaClient';
import "./styles.css";
import "./arena.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.search.includes('forge')?<ArenaClient/>:<App />}
  </React.StrictMode>
);
