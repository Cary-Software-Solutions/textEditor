/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import './index.css';

import {$createCodeNode,$isCodeHighlightNode} from '@lexical/code';
import {$isLinkNode, TOGGLE_LINK_COMMAND} from '@lexical/link';
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$createHeadingNode} from '@lexical/rich-text';
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from '@lexical/selection';
import {mergeRegister} from '@lexical/utils';
import {
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import {useCallback, useEffect, useRef, useState} from 'react';
import * as React from 'react';
import {createPortal} from 'react-dom';

import DropDown, {DropDownItem} from '../../ui/DropDown';
import DropdownColorPicker from '../../ui/DropdownColorPicker';
import {getDOMRangeRect} from '../../utils/getDOMRangeRect';
import {getSelectedNode} from '../../utils/getSelectedNode';
import {setFloatingElemPosition} from '../../utils/setFloatingElemPosition';

const FONT_FAMILY_OPTIONS: [string, string][] = [
  ['Arial', 'Arial'],
  ['Courier New', 'Courier New'],
  ['Georgia', 'Georgia'],
  ['Times New Roman', 'Times New Roman'],
  ['Trebuchet MS', 'Trebuchet MS'],
  ['Verdana', 'Verdana'],
];

const FONT_SIZE_OPTIONS: [string, string][] = [
  ['10px', '10px'],
  ['11px', '11px'],
  ['12px', '12px'],
  ['13px', '13px'],
  ['14px', '14px'],
  ['15px', '15px'],
  ['16px', '16px'],
  ['17px', '17px'],
  ['18px', '18px'],
  ['19px', '19px'],
  ['20px', '20px'],
];

function dropDownActiveClass(active: boolean) {
  if (active) return 'active dropdown-item-active';
  else return '';
}

function TextFormatFloatingToolbar({
  editor,
  anchorElem,
  isLink,
  isBold,
  isItalic,
  isUnderline,
  isCode,
  isStrikethrough,
  isSubscript,
  isSuperscript,
  isHighlight,
  isCodeBlock,
  isHeading,
  isListType,
  isMovementType,
  isSettingsType,
}: {
  editor: LexicalEditor;
  anchorElem: HTMLElement;
  isBold: boolean;
  isCode: boolean;
  isItalic: boolean;
  isLink: boolean;
  isStrikethrough: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isUnderline: boolean;
  isHihglight: boolean;
  isCodeBlock: boolean;
  isHeading: boolean;
  isListType: boolean;
  isMovementType: boolean;
  isSettingsType: boolean;
}): JSX.Element {
  const [bgColor, setBgColor] = useState<string>('#fff');
  const [fontColor, setFontColor] = useState<string>('#000');

  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState<string>('15px');

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  function FontDropDown({
    editorFont,
    value,
    style,
    disabled = false,
  }: {
    editorFont: LexicalEditor;
    value: string;
    style: string;
    disabled?: boolean;
  }): JSX.Element {
    const handleClick = useCallback(
      (option: string) => {
        editorFont.update(() => {
          const selection = $getSelection();
          if (
            $isRangeSelection(selection) ||
            DEPRECATED_$isGridSelection(selection)
          ) {
            $patchStyleText(selection, {
              [style]: option,
            });
          }
        });
      },
      [editor, style],
    );

    const buttonAriaLabel =
      style === 'font-family'
        ? 'Formatting options for font family'
        : 'Formatting options for font size';

    return (
      <DropDown
        disabled={disabled}
        buttonClassName={'toolbar-item ' + style}
        buttonLabel={value}
        buttonIconClassName={
          style === 'font-family' ? 'icon block-type font-family' : ''
        }
        buttonAriaLabel={buttonAriaLabel}>
        {(style === 'font-family'
          ? FONT_FAMILY_OPTIONS
          : FONT_SIZE_OPTIONS
        ).map(([option, text]) => (
          <DropDownItem
            className={`item ${dropDownActiveClass(value === option)} ${
              style === 'font-size' ? 'fontsize-item' : ''
            }`}
            onClick={() => handleClick(option)}
            key={option}>
            <span className="text">{text}</span>
          </DropDownItem>
        ))}
      </DropDown>
    );
  }

  function mouseMoveListener(e: MouseEvent) {
    if (
      popupCharStylesEditorRef?.current &&
      (e.buttons === 1 || e.buttons === 3)
    ) {
      if (popupCharStylesEditorRef.current.style.pointerEvents !== 'none') {
        const x = e.clientX;
        const y = e.clientY;
        const elementUnderMouse = document.elementFromPoint(x, y);

        if (!popupCharStylesEditorRef.current.contains(elementUnderMouse)) {
          // Mouse is not over the target element => not a normal click, but probably a drag
          popupCharStylesEditorRef.current.style.pointerEvents = 'none';
        }
      }
    }
  }
  function mouseUpListener(e: MouseEvent) {
    if (popupCharStylesEditorRef?.current) {
      if (popupCharStylesEditorRef.current.style.pointerEvents !== 'auto') {
        popupCharStylesEditorRef.current.style.pointerEvents = 'auto';
      }
    }
  }

  useEffect(() => {
    if (popupCharStylesEditorRef?.current) {
      document.addEventListener('mousemove', mouseMoveListener);
      document.addEventListener('mouseup', mouseUpListener);

      return () => {
        document.removeEventListener('mousemove', mouseMoveListener);
        document.removeEventListener('mouseup', mouseUpListener);
      };
    }
  }, [popupCharStylesEditorRef]);

  const updateTextFormatFloatingToolbar = useCallback(() => {
    const selection = $getSelection();

    const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
    const nativeSelection = window.getSelection();

    setBgColor(
      $getSelectionStyleValueForProperty(selection, 'background-color', '#fff'),
    );

    setFontColor(
      $getSelectionStyleValueForProperty(selection, 'color', '#000'),
    );

    if (popupCharStylesEditorElem === null) {
      return;
    }

    setFontFamily(
      $getSelectionStyleValueForProperty(selection, 'font-family', 'Arial'),
    );
    setFontSize(
      $getSelectionStyleValueForProperty(selection, 'font-size', '15px'),
    );

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const rangeRect = getDOMRangeRect(nativeSelection, rootElement);

      setFloatingElemPosition(
        rangeRect,
        popupCharStylesEditorElem,
        anchorElem,
        isLink,
      );
    }
  }, [editor, anchorElem, isLink]);

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement;

    const update = () => {
      editor.getEditorState().read(() => {
        updateTextFormatFloatingToolbar();
      });
    };

    window.addEventListener('resize', update);
    if (scrollerElem) {
      scrollerElem.addEventListener('scroll', update);
    }

    return () => {
      window.removeEventListener('resize', update);
      if (scrollerElem) {
        scrollerElem.removeEventListener('scroll', update);
      }
    };
  }, [editor, updateTextFormatFloatingToolbar, anchorElem]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateTextFormatFloatingToolbar();
    });
    return mergeRegister(
      editor.registerUpdateListener(({editorState}) => {
        editorState.read(() => {
          updateTextFormatFloatingToolbar();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateTextFormatFloatingToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateTextFormatFloatingToolbar]);

  const applyStyleText = useCallback(
    (styles: Record<string, string>) => {
      editor.update(() => {
        const selection = $getSelection();
        if (
          $isRangeSelection(selection) ||
          DEPRECATED_$isGridSelection(selection)
        ) {
          $patchStyleText(selection, styles);
        }
      });
    },
    [editor],
  );

  const onFontColorSelect = useCallback(
    (value: string) => {
      applyStyleText({color: value});
    },
    [applyStyleText],
  );

  const onBgColorSelect = useCallback(
    (value: string) => {
      applyStyleText({'background-color': value});
    },
    [applyStyleText],
  );

  const [isOpenHeading, setIsOpenHeading] = useState(false);
  const [isOpenList, setIsOpenList] = useState(false);

  const dropdownRefOpenList = useRef(null); // Reference to track the dropdown div
  const buttonRefOpenList = useRef(null); // Reference to track the button

  useEffect(() => {
    if (isOpenList) {
      const handleClickOutside = (event) => {
        // Check if the click is outside both the dropdown and the button
        if (
          dropdownRefOpenList.current &&
          !dropdownRefOpenList.current.contains(event.target) &&
          buttonRefOpenList.current &&
          !buttonRefOpenList.current.contains(event.target)
        ) {
          setIsOpenList(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Remove the event listener when the component unmounts or when the dropdown closes
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpenList]);

  const [isOpenMovement, setIsOpenMovement] = useState(false);

  const dropdownRefOpenMovement = useRef(null); // Reference to track the dropdown
  const buttonRefOpenMovement = useRef(null); // Reference to track the button

  useEffect(() => {
    if (isOpenMovement) {
      const handleClickOutside = (event) => {
        // Check if the click is outside both the dropdown and the button
        if (
          dropdownRefOpenMovement.current &&
          !dropdownRefOpenMovement.current.contains(event.target) &&
          buttonRefOpenMovement.current &&
          !buttonRefOpenMovement.current.contains(event.target)
        ) {
          setIsOpenMovement(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Remove the event listener when the component unmounts or when the dropdown closes
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpenMovement]);

  const [isOpenSettings, setIsOpenSettings] = useState(false);

  const dropdownRefOpenSettings = useRef(null); // Reference to track the dropdown
  const buttonRefOpenSettings = useRef(null); // Reference to track the button

  useEffect(() => {
    if (isOpenSettings) {
      const handleClickOutside = (event) => {
        // Check if the click is outside both the dropdown and the button
        if (
          dropdownRefOpenSettings.current &&
          !dropdownRefOpenSettings.current.contains(event.target) &&
          buttonRefOpenSettings.current &&
          !buttonRefOpenSettings.current.contains(event.target)
        ) {
          setIsOpenSettings(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Remove the event listener when the component unmounts or when the dropdown closes
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpenSettings]);

  const dropdownRefOpenHeading = useRef(null); // Reference to track the dropdow
  const buttonRefOpenHeading = useRef(null); // Reference to track the button

  useEffect(() => {
    if (isOpenHeading) {
      const handleClickOutside = (event) => {
        // Check if the click is outside both the dropdown and the button
        if (
          dropdownRefOpenHeading.current &&
          !dropdownRefOpenHeading.current.contains(event.target) &&
          buttonRefOpenHeading.current &&
          !buttonRefOpenHeading.current.contains(event.target)
        ) {
          setIsOpenHeading(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Remove the event listener when the component unmounts or when the dropdown closes
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpenHeading]);

  return (
    <div ref={popupCharStylesEditorRef} className="floating-text-format-popup">
      {editor.isEditable() && (
        <>
          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
            }}
            className={'popup-item spaced ' + (isBold ? 'active' : '')}
            aria-label="Format text as bold">
            <i className="format bold" />
          </button>
          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
            }}
            className={'popup-item spaced ' + (isItalic ? 'active' : '')}
            aria-label="Format text as italics">
            <i className="format italic" />
          </button>
          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
            }}
            className={'popup-item spaced ' + (isUnderline ? 'active' : '')}
            aria-label="Format text to underlined">
            <i className="format underline" />
          </button>
          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
            }}
            className={'popup-item spaced ' + (isStrikethrough ? 'active' : '')}
            aria-label="Format text with a strikethrough">
            <i className="format strikethrough" />
          </button>

          <DropdownColorPicker
            disabled={!editor.isEditable}
            buttonClassName="toolbar-item color-picker"
            buttonAriaLabel="Formatting background color"
            buttonIconClassName="icon bg-color"
            color={bgColor}
            onChange={onBgColorSelect}
            title="bg color"
            className={'popup-item spaced ' + (isStrikethrough ? 'active' : '')}
          />
          <button
            type="button"
            onClick={insertLink}
            className={'popup-item spaced ' + (isLink ? 'active' : '')}
            aria-label="Insert link">
            <i className="format link" />
          </button>
          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
            }}
            className={'popup-item spaced ' + (isCode ? 'active' : '')}
            aria-label="Insert code block">
            <i className="format code" />
          </button>
          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
            }}
            className={'popup-item spaced ' + (isSuperscript ? 'active' : '')}
            title="Superscript"
            aria-label="Format Superscript">
            <i className="format superscript" />
          </button>

          <button
            type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
            }}
            className={'popup-item spaced ' + (isSubscript ? 'active' : '')}
            title="Subscript"
            aria-label="Format Subscript">
            <i className="format subscript" />
          </button>

          <div className="vertical-divider" />

          <div style={{display: 'inline-block', position: 'relative'}}>
            <button
              type="button"
              ref={buttonRefOpenHeading}
              onClick={() => {
                setIsOpenHeading(!isOpenHeading);
              }}
              className={
                'headingHead popup-item spaced ' + (isHeading ? 'active' : '')
              }
              title="Heading"
              aria-label="Format Heading">
              <i className="icon Heading" />
            </button>

            {isOpenHeading && (
              <div
                ref={dropdownRefOpenHeading}
                className="dropdown"
                style={{
                  display: 'flex',
                  left: '50%',
                  position: 'absolute',
                  top: '100%',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                }}>
                <button
                  type="button"
                  onClick={() => {
                    editor.update(() => {
                      const selection = $getSelection();
                      if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () =>
                          $createHeadingNode(`h1`),
                        );
                      }
                    });
                  }}
                  className={'popup-item spaced ' + (isHeading ? 'active' : '')}
                  aria-label="format heading">
                  <i className="icon h1" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.update(() => {
                      const selection = $getSelection();
                      if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () =>
                          $createHeadingNode(`h2`),
                        );
                      }
                    });
                  }}
                  className={'popup-item spaced ' + (isHeading ? 'active' : '')}
                  aria-label="format heading">
                  <i className="icon h2" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.update(() => {
                      const selection = $getSelection();
                      if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () =>
                          $createHeadingNode(`h3`),
                        );
                      }
                    });
                  }}
                  className={'popup-item spaced ' + (isHeading ? 'active' : '')}
                  aria-label="format heading">
                  <i className="icon h3" />
                </button>
              </div>
            )}
          </div>
          <div style={{display: 'inline-block', position: 'relative'}}>
            <button
              type="button"
              ref={buttonRefOpenList}
              onClick={() => {
                setIsOpenList(!isOpenList);
              }}
              className={
                'headingHead popup-item spaced ' + (isListType ? 'active' : '')
              }
              title="List"
              aria-label="Format List">
              <i className="icon list" />
            </button>
            {isOpenList && (
              <div
                ref={dropdownRefOpenList}
                className="dropdown"
                style={{
                  display: 'flex',
                  left: '50%',
                  position: 'absolute',
                  top: '100%',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                }}>
                <button
                  type="button"
                  onClick={() => {
                    editor.dispatchCommand(
                      INSERT_ORDERED_LIST_COMMAND,
                      undefined,
                    );
                  }}
                  className={
                    'popup-item spaced ' + (isListType ? 'active' : '')
                  }
                  aria-label="format list">
                  <i className="icon number" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    editor.dispatchCommand(
                      INSERT_UNORDERED_LIST_COMMAND,
                      undefined,
                    );
                  }}
                  className={
                    'popup-item spaced ' + (isListType ? 'active' : '')
                  }
                  aria-label="format list">
                  <i className="icon bullet" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    editor.dispatchCommand(
                      INSERT_CHECK_LIST_COMMAND,
                      undefined,
                    );
                  }}
                  className={
                    'popup-item spaced ' + (isListType ? 'active' : '')
                  }
                  aria-label="format list">
                  <i className="icon check" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              editor.update(() => {
                const selection = $getSelection();

                if ($isRangeSelection(selection)) {
                  if (selection.isCollapsed()) {
                    $setBlocksType(selection, () => $createCodeNode());
                  } else {
                    // Will this ever happen?
                    const textContent = selection.getTextContent();
                    const codeNode = $createCodeNode();
                    selection.insertNodes([codeNode]);
                    selection.insertRawText(textContent);
                  }
                }
              });
            }}
            className={'popup-item spaced ' + (isCodeBlock ? 'active' : '')}
            title="CodeBlock"
            aria-label="Format CodeBlock">
            <i className="icon code" />
          </button>

          <div className="vertical-divider" />

          <div style={{display: 'inline-block', position: 'relative'}}>
            <button
              type="button"
              ref={buttonRefOpenMovement}
              onClick={() => {
                setIsOpenMovement(!isOpenMovement);
              }}
              className={
                'headingHead popup-item spaced ' +
                (isMovementType ? 'active' : '')
              }
              title="Movement"
              aria-label="Format Movement">
              <i className="icon movement" />
            </button>
            {isOpenMovement && (
              <div
                ref={dropdownRefOpenMovement}
                className="dropdown"
                style={{
                  display: 'flex',
                  left: '50%',
                  position: 'absolute',
                  top: '100%',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                }}>
                {(['left', 'center', 'right', 'justify'] as const).map(
                  (alignment) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor.dispatchCommand(
                          FORMAT_ELEMENT_COMMAND,
                          alignment,
                        );
                      }}
                      className={
                        'popup-item spaced ' + (isMovementType ? 'active' : '')
                      }
                      aria-label="format movement">
                      <i className={`icon ${alignment}-align`} />
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          <div style={{display: 'inline-block', position: 'relative'}}>
            <button
              type="button"
              ref={buttonRefOpenSettings}
              onClick={() => {
                setIsOpenSettings(!isOpenSettings);
              }}
              className={
                'headingHead popup-item spaced ' +
                (isSettingsType ? 'active' : '')
              }
              title="Settings"
              aria-label="Format Settings">
              <i className="icon Settings" />
            </button>
            {isOpenSettings && (
              <div
                className="dropdown"
                style={{
                  display: 'flex',
                  left: '50%',
                  position: 'absolute',
                  top: '100%',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                }}>
                <FontDropDown
                  disabled={!editor.isEditable}
                  style={'font-family'}
                  value={fontFamily}
                  editorFont={editor}
                />

                <FontDropDown
                  disabled={!editor.isEditable}
                  style={'font-size'}
                  value={fontSize}
                  editorFont={editor}
                />

                <DropdownColorPicker
                  disabled={!editor.isEditable}
                  buttonClassName="toolbar-item color-picker"
                  buttonAriaLabel="Formatting text color"
                  buttonIconClassName="icon font-color"
                  color={fontColor}
                  onChange={onFontColorSelect}
                  title="text color"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function useFloatingTextFormatToolbar(
  editor: LexicalEditor,
  anchorElem: HTMLElement,
): JSX.Element | null {
  const [isText, setIsText] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isCode, setIsCode] = useState(false);

  const updatePopup = useCallback(() => {
    editor.getEditorState().read(() => {
      // Should not to pop up the floating toolbar when using IME input
      if (editor.isComposing()) {
        return;
      }
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) ||
          rootElement === null ||
          !rootElement.contains(nativeSelection.anchorNode))
      ) {
        setIsText(false);
        return;
      }

      if (!$isRangeSelection(selection)) {
        return;
      }

      const node = getSelectedNode(selection);

      // Update text format
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      setIsCode(selection.hasFormat('code'));

      // Update links
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }

      if (
        !$isCodeHighlightNode(selection.anchor.getNode()) &&
        selection.getTextContent() !== ''
      ) {
        setIsText($isTextNode(node) || $isParagraphNode(node));
      } else {
        setIsText(false);
      }

      const rawTextContent = selection.getTextContent().replace(/\n/g, '');
      if (!selection.isCollapsed() && rawTextContent === '') {
        setIsText(false);
        return;
      }
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener('selectionchange', updatePopup);
    return () => {
      document.removeEventListener('selectionchange', updatePopup);
    };
  }, [updatePopup]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        updatePopup();
      }),
      editor.registerRootListener(() => {
        if (editor.getRootElement() === null) {
          setIsText(false);
        }
      }),
    );
  }, [editor, updatePopup]);

  if (!isText) {
    return null;
  }

  return createPortal(
    <TextFormatFloatingToolbar
      editor={editor}
      anchorElem={anchorElem}
      isLink={isLink}
      isBold={isBold}
      isItalic={isItalic}
      isStrikethrough={isStrikethrough}
      isSubscript={isSubscript}
      isSuperscript={isSuperscript}
      isUnderline={isUnderline}
      isCode={isCode}
    />,
    anchorElem,
  );
}

export default function FloatingTextFormatToolbarPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  return useFloatingTextFormatToolbar(editor, anchorElem);
}
