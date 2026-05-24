"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import DOMPurify from 'isomorphic-dompurify'
import { useEffect, useState } from 'react'
import { Bold, Code2, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Unlink } from 'lucide-react'

export function TipTapEditor({
    name,
    defaultValue = "",
    value,
    onChange,
    placeholder = "Write something...",
    dense = false,
}: {
    name: string;
    defaultValue?: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    dense?: boolean;
}) {
    const initialContent = value ?? defaultValue
    const [htmlValue, setHtmlValue] = useState(initialContent)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: false,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: 'https',
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content: initialContent,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: `${dense ? 'min-h-[96px]' : 'min-h-[160px]'} prose prose-slate dark:prose-invert max-w-none focus:outline-none`,
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            const nextValue = DOMPurify.sanitize(currentEditor.getHTML())
            setHtmlValue(nextValue)
            onChange?.(nextValue)
        },
    })

    useEffect(() => {
        if (!editor) {
            return
        }

        const nextValue = DOMPurify.sanitize(value ?? defaultValue)

        if (nextValue !== htmlValue) {
            setHtmlValue(nextValue)
        }

        if (nextValue !== DOMPurify.sanitize(editor.getHTML())) {
            editor.commands.setContent(nextValue || '', { emitUpdate: false })
        }
    }, [defaultValue, editor, htmlValue, value])

    // Prevent hydration mismatch
    if (!editor) {
        return null
    }

    const toolbarButtonClassName = `${dense ? 'h-8 w-8' : 'h-9 w-9'} inline-flex items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50`

    const handleLinkToggle = () => {
        const currentHref = editor.getAttributes('link').href as string | undefined
        const nextHref = window.prompt('Enter a URL', currentHref ?? 'https://')

        if (nextHref === null) {
            return
        }

        const trimmedHref = nextHref.trim()

        if (!trimmedHref) {
            editor.chain().focus().unsetLink().run()
            return
        }

        const normalizedHref = /^(https?:\/\/|mailto:)/i.test(trimmedHref) ? trimmedHref : `https://${trimmedHref}`
        editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedHref }).run()
    }

    return (
        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-card/88 shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
            <div className="flex flex-wrap gap-2 border-b border-border/70 bg-muted/30 px-3 py-3">
                <button type="button" aria-label="Bold" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={toolbarButtonClassName}>
                    <Bold className={`h-4 w-4 ${editor.isActive('bold') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Italic" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={toolbarButtonClassName}>
                    <Italic className={`h-4 w-4 ${editor.isActive('italic') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Heading" title="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toolbarButtonClassName}>
                    <Heading2 className={`h-4 w-4 ${editor.isActive('heading', { level: 2 }) ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Bullet List" title="Bullet List" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarButtonClassName}>
                    <List className={`h-4 w-4 ${editor.isActive('bulletList') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Numbered List" title="Numbered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarButtonClassName}>
                    <ListOrdered className={`h-4 w-4 ${editor.isActive('orderedList') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Quote" title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toolbarButtonClassName}>
                    <Quote className={`h-4 w-4 ${editor.isActive('blockquote') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Code Block" title="Code Block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toolbarButtonClassName}>
                    <Code2 className={`h-4 w-4 ${editor.isActive('codeBlock') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Insert Link" title="Insert Link" onClick={handleLinkToggle} className={toolbarButtonClassName}>
                    <Link2 className={`h-4 w-4 ${editor.isActive('link') ? 'text-sky-500' : ''}`} />
                </button>
                <button type="button" aria-label="Remove Link" title="Remove Link" onClick={() => editor.chain().focus().unsetLink().run()} className={toolbarButtonClassName} disabled={!editor.isActive('link')}>
                    <Unlink className="h-4 w-4" />
                </button>
                <div className="ml-auto flex gap-2">
                    <button type="button" aria-label="Undo" title="Undo" onClick={() => editor.chain().focus().undo().run()} className={toolbarButtonClassName} disabled={!editor.can().chain().focus().undo().run()}>
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="Redo" title="Redo" onClick={() => editor.chain().focus().redo().run()} className={toolbarButtonClassName} disabled={!editor.can().chain().focus().redo().run()}>
                        <Redo2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div className="px-4 py-4">
                <EditorContent editor={editor} aria-label={placeholder} />
            </div>
            {/* Hidden input to pass HTML value to standard FormData processing */}
            <input type="hidden" name={name} value={value ?? htmlValue} readOnly />
        </div>
    )
}
