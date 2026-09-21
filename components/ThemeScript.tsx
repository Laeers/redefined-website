import Script from "next/script";

/** Kører tidligt — læser gemt tema så <html class="dark"> matcher før første paint */
export default function ThemeScript() {
  return (
    <Script id="redefined-theme-init" strategy="beforeInteractive">
      {`(function(){try{var k='redefined-theme';var s=localStorage.getItem(k);var d=document.documentElement;if(s==='dark')d.classList.add('dark');else d.classList.remove('dark');}catch(e){}})();`}
    </Script>
  );
}
