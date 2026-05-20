"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import DOMPurify from 'isomorphic-dompurify'
import { useEffect } from 'react'

export function TipTapEditor({ name, defaultValue = "", placeholder = "Write something..." }: { name: string, defaultValue?: string, placeholder?: string }) {
    const editor = useEditor({
        extensions: [
            StarterKit,
        ],
        content: defaultValue,
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px]',
            },
        },
    })

    // Prevent hydration mismatch
    if (!editor) {
        return null
    }

    return (
        <div className="border-2 border-black dark:border-white p-3 bg-transparent focus-within:ring-2 focus-within:ring-blue-500">
            <div className="flex gap-2 mb-2 pb-2 border-b-2 border-black/10 dark:border-white/10 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`px-2 py-1 font-bold text-xs uppercase border-2 border-black dark:border-white ${editor.isActive('bold') ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
                >
          Bold
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`px-2 py-1 font-bold text-xs uppercase border-2 border-black dark:border-white ${editor.isActive('italic') ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
                >
          Italic
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`px-2 py-1 font-bold text-xs uppercase border-2 border-black dark:border-white ${editor.isActive('codeBlock') ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
                >
          Code Block
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`px-2 py-1 font-bold text-xs uppercase border-2 border-black dark:border-white ${editor.isActive('blockquote') ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
                >
          Quote
                </button>
            </div>
            <EditorContent editor={editor} />
            {/* Hidden input to pass HTML value to standard FormData processing */}
            <input type="hidden" name={name} value={DOMPurify.sanitize(editor.getHTML())} />
        </div>
    )
}
