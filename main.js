const editor = document.getElementById("editor")
const terminal = document.getElementById("terminal")
const FUCK = document.getElementById("FUCK")


FUCK.onclick = () => {
  terminal.textContent = ""
  Module.callMain([])
}


// FUCK.onclick = () => {

//   terminal.textContent = ""

//   const input = editor.value + "\n"
//   const data = new TextEncoder().encode(input)

//   let i = 0

//   Module.stdin = () => {
//     return i < data.length ? data[i++] : null
//   }

//   Module.callMain([])
// }