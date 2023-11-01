/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
} from 'lexical';
import {useEffect, useRef} from 'react';

type ParagraphPlaceholderPluginProps = {
  placeholder: string;
  hideOnEmptyEditor?: boolean;
};

export default function ParagraphPlaceholderPlugin({
  placeholder,
  hideOnEmptyEditor,
}: ParagraphPlaceholderPluginProps) {
  const [editor] = useLexicalComposerContext();
  const paragraphRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Add the styles
    const style = document.createElement('style');
    style.innerHTML = `
      .activePlaceholder {
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      }
      .activePlaceholder::before {
        content: attr(data-placeholder);
        color: gray;
        pointer-events: none;
        position: absolute;
        left: 0;
        top: 0;
      }
      @media (prefers-color-scheme: dark) {
        .activePlaceholder::before {
          color: #747C92; /* dark:text-zinc-600 equivalent */
        }
      }
    `;
    document.head.appendChild(style);

    const removeUpdateListener = editor.registerUpdateListener(
      ({editorState}) => {
        const nativeSelection = window.getSelection();

        editorState.read(() => {
          // Cleanup
          if (paragraphRef?.current) {
            paragraphRef.current.removeAttribute('data-placeholder');
            paragraphRef.current.classList.remove('activePlaceholder');
            paragraphRef.current = null;
          }

          const selection = $getSelection();

          if (!nativeSelection || !selection || !$isRangeSelection(selection))
            return;

          if (hideOnEmptyEditor) {
            const textContentSize = $getRoot().getTextContentSize();

            if (!textContentSize) return;
          }

          const parentNode = selection.anchor.getNode();

          if (!$isParagraphNode(parentNode) || !parentNode.isEmpty()) return;

          // It's a paragraph node, it's empty, and it's selected
          const paragraphDOMElement = nativeSelection.anchorNode;

          if (!paragraphDOMElement) return;

          if (paragraphDOMElement instanceof HTMLParagraphElement) {
            paragraphRef.current = paragraphDOMElement;
            paragraphRef.current.setAttribute('data-placeholder', placeholder);
            paragraphRef.current.classList.add('activePlaceholder');
          }
        });
      },
    );

    return () => {
      removeUpdateListener();
    };
  }, [editor, hideOnEmptyEditor, placeholder]);

  return null;
}
