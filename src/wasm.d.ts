/**
 * wrangler 会把 .wasm 文件按 CompiledWasm 规则打包成 WebAssembly.Module，
 * 运行时 import 拿到的就是这个 Module 实例。
 */
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}
