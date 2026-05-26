"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import DOMPurify from 'isomorphic-dompurify'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Code2, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Unlink } from 'lucide-react'

type TiptapEditorInstance = NonNullable<ReturnType<typeof useEditor>>

type ActiveMentionState = {
    from: number;
    to: number;
    query: string;
    suggestions: string[];
}

export function TipTapEditor({
    name,
    defaultValue = "",
    value,
    onChange,
    onKeyDown,
    placeholder = "Write something...",
    dense = false,
    mentionSuggestions = [],
}: {
    name: string;
    defaultValue?: string;
    value?: string;
    onChange?: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent) => boolean | void;
    placeholder?: string;
    dense?: boolean;
    mentionSuggestions?: string[];
}) {
    const initialContent = value ?? defaultValue
    const [htmlValue, setHtmlValue] = useState(initialContent)
    const [activeMention, setActiveMention] = useState<ActiveMentionState | null>(null)
    const [activeMentionIndex, setActiveMentionIndex] = useState(0)
    const activeMentionRef = useRef<ActiveMentionState | null>(null)
    const activeMentionIndexRef = useRef(0)

    const normalizedMentionSuggestions = useMemo(() => mentionSuggestions.reduce<string[]>((suggestions, suggestion) => {
        const nextSuggestion = suggestion.trim()

        if (!nextSuggestion) {
            return suggestions
        }

        if (suggestions.some((existingSuggestion) => existingSuggestion.toLowerCase() === nextSuggestion.toLowerCase())) {
            return suggestions
        }

        suggestions.push(nextSuggestion)
        return suggestions
    }, []), [mentionSuggestions])

    const buildActiveMention = useCallback((currentEditor: TiptapEditorInstance) => {
        if (normalizedMentionSuggestions.length === 0) {
            return null
        }

        const { from, to } = currentEditor.state.selection
        if (from !== to) {
            return null
        }

        const textBeforeCursor = currentEditor.state.doc.textBetween(Math.max(0, from - 60), from, '\n', '\n')
        const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/)

        if (!mentionMatch) {
            return null
        }

        const queryText = (mentionMatch[1] || '').toLowerCase()
        const suggestions = normalizedMentionSuggestions.filter((suggestion) => suggestion.toLowerCase().includes(queryText)).slice(0, 6)

        if (suggestions.length === 0) {
            return null
        }

        return {
            from: from - (queryText.length + 1),
            to: from,
            query: queryText,
            suggestions,
        }
    }, [normalizedMentionSuggestions])

    const updateActiveMention = useCallback((currentEditor: TiptapEditorInstance) => {
        const nextMention = buildActiveMention(currentEditor)

        setActiveMention((previousMention) => {
            if (!nextMention) {
                setActiveMentionIndex(0)
                return null
            }

            if (!previousMention || previousMention.query !== nextMention.query) {
                setActiveMentionIndex(0)
            }

            return nextMention
        })
    }, [buildActiveMention])

    const insertMention = (editorInstance: TiptapEditorInstance, suggestion: string) => {
        const currentMention = activeMentionRef.current

        if (!currentMention) {
            return
        }

        if (suggestion.toLowerCase() === 'all') {
            editorInstance.chain().focus().insertContentAt({ from: currentMention.from, to: currentMention.to }, `@${suggestion} `).run()
        } else {
            editorInstance.chain().focus().insertContentAt(
                { from: currentMention.from, to: currentMention.to },
                `<a href="/users/${encodeURIComponent(suggestion)}" data-mention="true" class="mq-mention">@${suggestion}</a>&nbsp;`,
            ).run()
        }

        setActiveMention(null)
        setActiveMentionIndex(0)
    }

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
            handleKeyDown: (_view, event) => {
                if (activeMentionRef.current) {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setActiveMentionIndex((currentIndex) => (currentIndex + 1) % activeMentionRef.current!.suggestions.length)
                        return true
                    }

                    if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setActiveMentionIndex((currentIndex) => (currentIndex - 1 + activeMentionRef.current!.suggestions.length) % activeMentionRef.current!.suggestions.length)
                        return true
                    }

                    if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
                        event.preventDefault()
                        const suggestion = activeMentionRef.current.suggestions[activeMentionIndexRef.current] || activeMentionRef.current.suggestions[0]

                        if (suggestion && editor) {
                            insertMention(editor, suggestion)
                            return true
                        }
                    }

                    if (event.key === 'Escape') {
                        event.preventDefault()
                        setActiveMention(null)
                        setActiveMentionIndex(0)
                        return true
                    }
                }

                return onKeyDown?.(event) === true;
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            const nextValue = DOMPurify.sanitize(currentEditor.getHTML())
            setHtmlValue(nextValue)
            onChange?.(nextValue)
            updateActiveMention(currentEditor)
        },
        onSelectionUpdate: ({ editor: currentEditor }) => {
            updateActiveMention(currentEditor)
        },
    })

    useEffect(() => {
        activeMentionRef.current = activeMention
    }, [activeMention])

    useEffect(() => {
        activeMentionIndexRef.current = activeMentionIndex
    }, [activeMentionIndex])

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

    useEffect(() => {
        if (!editor) {
            return
        }

        updateActiveMention(editor)
    }, [editor, mentionSuggestions, updateActiveMention])

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
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/88 shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
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
            {activeMention && (
                <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mentions</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {activeMention.suggestions.map((suggestion, index) => (
                            <button
                                key={suggestion}
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault()
                                    if (editor) {
                                        insertMention(editor, suggestion)
                                    }
                                }}
                                className={index === activeMentionIndex
                                    ? 'rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300'
                                    : 'rounded-full border border-border/70 bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 transition hover:border-sky-400/60 hover:text-foreground'}
                            >
                                @{suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {/* Hidden input to pass HTML value to standard FormData processing */}
            <input type="hidden" name={name} value={value ?? htmlValue} readOnly />
        </div>
    )
}
