/** CSS Modules type shim for this package's `*.module.css` imports. */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
