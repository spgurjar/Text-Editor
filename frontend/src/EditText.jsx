import { useCallback, useEffect, useState, useRef  } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { io } from "socket.io-client"
import { useParams } from "react-router-dom"
import html2pdf from 'html2pdf.js'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun } from 'docx'

const SAVE_INTERVAL_MS = 2000
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
]

export default function EditText() {
  const { id: documentId } = useParams()
  const [socket, setSocket] = useState()
  const [quill, setQuill] = useState()
  const [shareMessage, setShareMessage] = useState("")
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState(false)
  const saveDropdownRef = useRef(null)

  

  useEffect(() => {
    const s = io("https://text-editor-qn87.vercel.app/")
    console.log("base", process.env.REACT_APP_BASE_URL)
    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [])

  useEffect(() => {
    if (socket == null || quill == null) return

    socket.once("load-document", document => {
      quill.setContents(document)
      quill.enable()
    })

    socket.emit("get-document", documentId)
  }, [socket, quill, documentId])

  useEffect(() => {
    if (socket == null || quill == null) return

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents())
    }, SAVE_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [socket, quill])

  useEffect(() => {
    if (socket == null || quill == null) return

    const handler = delta => {
      quill.updateContents(delta)
    }
    socket.on("receive-changes", handler)

    return () => {
      socket.off("receive-changes", handler)
    }
  }, [socket, quill])

  useEffect(() => {
    if (socket == null || quill == null) return

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return
      socket.emit("send-changes", delta)
    }
    quill.on("text-change", handler)

    return () => {
      quill.off("text-change", handler)
    }
  }, [socket, quill])

  const wrapperRef = useCallback(wrapper => {
    if (wrapper == null) return

    wrapper.innerHTML = ""
    const editor = document.createElement("div")
    wrapper.append(editor)
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    })
    q.disable()
    q.setText("Loading...")
    setQuill(q)
  }, [])

  const saveAsPDF = () => {
    const element = document.querySelector('.ql-editor')
    html2pdf().from(element).save('document.pdf')
    setIsSaveDropdownOpen(false)
  }

  const saveAsWord = () => {
    const content = quill.getText()
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun(content)],
          }),
        ],
      }],
    })

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, 'document.docx')
    })
    setIsSaveDropdownOpen(false)
  }

  const shareDocument = () => {
    const shareableLink = `${window.location.origin}/documents/${documentId}`
    navigator.clipboard.writeText(shareableLink).then(() => {
      setShareMessage("copied to clipboard!")
      setTimeout(() => setShareMessage(""), 3000) // Clear message after 3 seconds
    }, (err) => {
      console.error('Could not copy text: ', err)
      setShareMessage("Failed to copy link. Please try again.")
      setTimeout(() => setShareMessage(""), 3000)
    })
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(event.target)) {
        setIsSaveDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])


  return (
    <div >
      <div className="toolbar-wrapper">
        <div className="container" ref={wrapperRef}></div>
        <div className="custom-toolbar">
          <div className="save-dropdown" ref={saveDropdownRef}>
            <button className="save" onClick={() => setIsSaveDropdownOpen(!isSaveDropdownOpen)}>Save</button>
            {isSaveDropdownOpen && (
              <div className="dropdown-content">
                <button className="saveBtn" onClick={saveAsPDF}>Save as PDF</button>
                <button className="saveBtn" onClick={saveAsWord}>Save as Word</button>
              </div>
            )}
          </div>
          <button className="share" onClick={shareDocument}>Share</button>
        </div>
      </div>
      {shareMessage && <span className="share-message">{shareMessage}</span>}
    </div>
  )
}