'use client';

import type { UiTextTranslator } from './ui-translation';

import { useEffect } from 'react';

import { useTranslate } from './use-locales';

// ----------------------------------------------------------------------

const TRANSLATABLE_ATTRIBUTES = ['alt', 'aria-label', 'content', 'placeholder', 'title'] as const;
const THAI_PATTERN = /[ก-๙]/;
const originalText = new WeakMap<Text, string>();
const translatedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = new WeakMap<Element, Map<string, string>>();

function shouldSkip(element: Element | null) {
  if (!element) return true;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'].includes(element.tagName)) return true;
  return !!element.closest('[data-no-translate], [contenteditable="true"]');
}

function updateTextNode(node: Text, translator?: UiTextTranslator) {
  if (shouldSkip(node.parentElement)) return;

  if (!translator) {
    const original = originalText.get(node);
    if (original !== undefined && node.nodeValue !== original) node.nodeValue = original;
    translatedText.delete(node);
    return;
  }

  const current = node.nodeValue ?? '';
  const lastTranslated = translatedText.get(node);
  if (current === lastTranslated) return;

  if (lastTranslated !== undefined && THAI_PATTERN.test(current)) {
    originalText.set(node, current);
  }

  if (!originalText.has(node)) {
    if (!THAI_PATTERN.test(current)) return;
    originalText.set(node, current);
  }

  const source = originalText.get(node) ?? current;
  const translated = translator(source);
  translatedText.set(node, translated);
  if (translated !== current) node.nodeValue = translated;
}

function updateElementAttributes(element: Element, translator?: UiTextTranslator) {
  if (shouldSkip(element)) return;

  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;

    let attributes = originalAttributes.get(element);
    let translated = translatedAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }
    if (!translated) {
      translated = new Map();
      translatedAttributes.set(element, translated);
    }

    const lastTranslated = translated.get(attribute);

    if (!translator) {
      const source = attributes.get(attribute);
      if (source !== undefined && source !== current) element.setAttribute(attribute, source);
      translated.delete(attribute);
      continue;
    }

    if (current === lastTranslated) continue;
    if (lastTranslated !== undefined && THAI_PATTERN.test(current)) {
      attributes.set(attribute, current);
    }

    if (!attributes.has(attribute)) {
      if (!THAI_PATTERN.test(current)) continue;
      attributes.set(attribute, current);
    }
    const source = attributes.get(attribute) ?? current;
    const nextValue = translator(source);
    translated.set(attribute, nextValue);
    if (nextValue !== current) element.setAttribute(attribute, nextValue);
  }
}

function translateTree(root: Node, translator?: UiTextTranslator) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateTextNode(root as Text, translator);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) updateElementAttributes(root as Element, translator);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) updateTextNode(node as Text, translator);
    if (node.nodeType === Node.ELEMENT_NODE) updateElementAttributes(node as Element, translator);
    node = walker.nextNode();
  }
}

export function UiTranslationBridge() {
  const { currentLang } = useTranslate();

  useEffect(() => {
    const english = currentLang.value === 'en';
    const root = document.documentElement;
    let cancelled = false;
    let observer: MutationObserver | undefined;

    if (!english) {
      translateTree(root);
      return undefined;
    }

    const startEnglishTranslation = async () => {
      const { loadUiTextTranslator } = await import('./ui-translation');
      const translator = await loadUiTextTranslator();
      if (cancelled) return;

      translateTree(root, translator);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            updateTextNode(mutation.target as Text, translator);
          }

          if (mutation.type === 'attributes' && mutation.target instanceof Element) {
            updateElementAttributes(mutation.target, translator);
          }

          mutation.addedNodes.forEach((node) => translateTree(node, translator));
        }
      });

      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      });
    };

    void startEnglishTranslation();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [currentLang.value]);

  return null;
}
