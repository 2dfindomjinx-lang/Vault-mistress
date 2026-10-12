export type ColorMode = "light" | "dark";
export const COLOR_MODE_KEY = "vault-color-mode";

// Runs in <head> before first paint. No account data or cookies are involved.
export const colorModeBootstrap = `(function(){var mode;try{mode=localStorage.getItem('${COLOR_MODE_KEY}')}catch(e){}if(mode!=='light'&&mode!=='dark')mode=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.colorMode=mode;document.documentElement.style.colorScheme=mode;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=mode==='dark'?'#181323':'#d7eef0';})();`;
