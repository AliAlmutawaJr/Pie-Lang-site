const editor = document.getElementById("editor")
const terminal = document.getElementById("terminal")
const run = document.getElementById("Run")


run.onclick = () => {
  terminal.textContent = ""
  Module.callMain([])
}


// run.onclick = () => {

//   terminal.textContent = ""

//   const input = editor.value + "\n"
//   const data = new TextEncoder().encode(input)

//   let i = 0

//   Module.stdin = () => {
//     return i < data.length ? data[i++] : null
//   }

//   Module.callMain([])
// }