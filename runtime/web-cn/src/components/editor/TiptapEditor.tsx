'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Space } from 'antd';
import {
    BoldOutlined,
    ItalicOutlined,
    OrderedListOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
}

const ToolbarButton = ({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) => (
    <button
        type="button"
        onClick={onClick}
        className={clsx(
            "p-1.5 rounded-lg transition-all text-sm flex items-center justify-center",
            active
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "text-zinc-400 hover:text-white hover:bg-white/10"
        )}
    >
        {icon}
    </button>
);

export const TiptapEditor = ({ content, onChange }: TiptapEditorProps) => {
    const editor = useEditor({
        extensions: [StarterKit],
        content: content,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-zinc-900 placeholder-zinc-400',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="glass rounded-xl overflow-hidden border border-white/5 flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-2 border-b border-white/5 bg-zinc-900/30 backdrop-blur flex items-center gap-2">
                <ToolbarButton
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    icon={<BoldOutlined />}
                />
                <ToolbarButton
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    icon={<ItalicOutlined />}
                />
                <div className="w-px h-4 bg-white/10 mx-1" />
                <ToolbarButton
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    icon={<UnorderedListOutlined />}
                />
                <ToolbarButton
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    icon={<OrderedListOutlined />}
                />
            </div>

            {/* Scrollable Editor Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

