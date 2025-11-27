import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Vlastní Image extension s resize funkcionalitou
 * - Čistý HTML výstup s width/height atributy (BEZ hacků!)
 * - data-align pro pozicování (left/center/right)
 * - data-float pro obtékání textem (left/right/none)
 * - Vlastní resize handle bez externích závislostí
 */

// Utility funkce pro aplikaci stylů (DRY - odstranění duplicit)
const applyAlignmentStyles = (element, align) => {
  if (align === 'left') {
    element.style.marginLeft = '0';
    element.style.marginRight = 'auto';
  } else if (align === 'center') {
    element.style.marginLeft = 'auto';
    element.style.marginRight = 'auto';
  } else if (align === 'right') {
    element.style.marginLeft = 'auto';
    element.style.marginRight = '0';
  }
};

const applyFloatStyles = (element, float) => {
  if (float === 'left') {
    element.style.float = 'left';
    element.style.marginRight = '1rem';
    element.style.marginBottom = '0.5rem';
  } else if (float === 'right') {
    element.style.float = 'right';
    element.style.marginLeft = '1rem';
    element.style.marginBottom = '0.5rem';
  } else {
    element.style.float = 'none';
  }
};

// XSS ochrana: Validace URL (pouze http/https/data protokoly)
const isSafeUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:', 'data:'].includes(parsed.protocol);
  } catch {
    // Relativní URL - považujeme za bezpečné
    return url.startsWith('/') || url.startsWith('./');
  }
};

// Bezpečné vytvoření SVG ikony (místo innerHTML)
const createResizeIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'white');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const paths = [
    'M11 19h-6a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4',
    'M14 14m0 1a1 1 0 0 1 1 -1h5a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1z',
    'M7 9l4 4',
    'M7 12v-3h3'
  ];

  paths.forEach(d => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });

  return svg;
};

const ImageExtended = Node.create({
  name: 'image',
  group: 'block',
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => ({
          src: attributes.src,
        }),
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => ({
          alt: attributes.alt,
        }),
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('title'),
        renderHTML: attributes => {
          if (!attributes.title) return {};
          return { title: attributes.title };
        },
      },
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? parseInt(width) : null;
        },
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? parseInt(height) : null;
        },
        renderHTML: attributes => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      'data-align': {
        default: 'left',
        parseHTML: element => element.getAttribute('data-align') || 'left',
        renderHTML: attributes => ({
          'data-align': attributes['data-align'],
        }),
      },
      'data-float': {
        default: 'none',
        parseHTML: element => element.getAttribute('data-float') || 'none',
        renderHTML: attributes => ({
          'data-float': attributes['data-float'],
        }),
      },
      'data-file-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-file-id'),
        renderHTML: attributes => {
          if (!attributes['data-file-id']) return {};
          return { 'data-file-id': attributes['data-file-id'] };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },

      setImageAlign: align => ({ commands }) => {
        return commands.updateAttributes(this.name, { 'data-align': align });
      },

      setImageFloat: float => ({ commands }) => {
        return commands.updateAttributes(this.name, { 'data-float': float });
      },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const extensionName = this.name;
      const extensionType = this.type;

      // XSS ochrana: Validace URL
      if (!isSafeUrl(node.attrs.src)) {
        console.error('Unsafe image URL blocked:', node.attrs.src);
        return { dom: document.createTextNode('[Nebezpečný obrázek]') };
      }

      // Container pro obrázek a resize handle
      const container = document.createElement('div');
      container.className = 'image-resizer';
      container.style.cssText = 'position: relative; display: block; max-width: 100%;';

      // Data atributy pro CSS styling
      container.setAttribute('data-align', node.attrs['data-align']);
      container.setAttribute('data-float', node.attrs['data-float']);

      // Aplikace align/float stylů na container
      const align = node.attrs['data-align'];
      const float = node.attrs['data-float'];

      applyAlignmentStyles(container, align);
      if (float === 'left' || float === 'right') {
        container.style.display = 'inline-block';
      }
      applyFloatStyles(container, float);

      // Vytvoření img elementu
      const img = document.createElement('img');
      img.src = node.attrs.src;

      // XSS ochrana: textContent místo setAttribute pro user-generated text
      if (node.attrs.alt) {
        img.alt = node.attrs.alt;
      }
      if (node.attrs.title) {
        img.title = node.attrs.title;
      }

      // Data atributy
      img.setAttribute('data-align', node.attrs['data-align']);
      img.setAttribute('data-float', node.attrs['data-float']);
      if (node.attrs['data-file-id']) {
        img.setAttribute('data-file-id', node.attrs['data-file-id']);
      }

      // Base styly
      img.style.cssText = 'display: block; max-width: 100%; height: auto; cursor: pointer;';

      // Width/height po base stylech (aby se nepřepsaly)
      if (node.attrs.width) img.style.width = `${node.attrs.width}px`;
      if (node.attrs.height) img.style.height = `${node.attrs.height}px`;

      // Aplikace align/float stylů na img
      applyAlignmentStyles(img, align);
      applyFloatStyles(img, float);

      // Resize handle
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        cursor: nwse-resize;
        display: none;
        background: rgba(59, 130, 246, 0.9);
        border-radius: 4px;
        padding: 2px;
      `;

      // XSS ochrana: Bezpečné vytvoření SVG
      resizeHandle.appendChild(createResizeIcon());

      // Resize logika
      let isResizing = false;
      let startX, startWidth;

      const handleMouseDown = (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startWidth = img.offsetWidth;
        document.body.style.cursor = 'nwse-resize';
      };

      const handleMouseMove = (e) => {
        if (!isResizing) return;
        const width = startWidth + (e.clientX - startX);
        if (width > 50) {
          img.style.width = `${width}px`;
          img.style.height = 'auto';
        }
      };

      const handleMouseUp = () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = '';
          const width = img.offsetWidth;
          const height = img.offsetHeight;

          if (typeof getPos === 'function') {
            editor.commands.updateAttributes(extensionName, { width, height });
          }
        }
      };

      const handleMouseEnter = () => {
        resizeHandle.style.display = 'block';
      };

      const handleMouseLeave = () => {
        if (!isResizing) {
          resizeHandle.style.display = 'none';
        }
      };

      // Připojení event listenerů
      resizeHandle.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);

      // Sestavení DOM
      container.appendChild(img);
      container.appendChild(resizeHandle);

      return {
        dom: container,
        contentDOM: null,

        update: (updatedNode) => {
          if (updatedNode.type !== extensionType) {
            return false;
          }

          // XSS ochrana: Validace URL
          if (!isSafeUrl(updatedNode.attrs.src)) {
            console.error('Unsafe image URL blocked:', updatedNode.attrs.src);
            return false;
          }

          // Update img atributů
          img.src = updatedNode.attrs.src;
          if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt;
          if (updatedNode.attrs.title) img.title = updatedNode.attrs.title;
          if (updatedNode.attrs.width) img.style.width = `${updatedNode.attrs.width}px`;
          if (updatedNode.attrs.height) img.style.height = `${updatedNode.attrs.height}px`;

          // Update data atributů
          const newAlign = updatedNode.attrs['data-align'];
          const newFloat = updatedNode.attrs['data-float'];

          img.setAttribute('data-align', newAlign);
          img.setAttribute('data-float', newFloat);
          container.setAttribute('data-align', newAlign);
          container.setAttribute('data-float', newFloat);

          if (updatedNode.attrs['data-file-id']) {
            img.setAttribute('data-file-id', updatedNode.attrs['data-file-id']);
          }

          // Update stylů pomocí utility funkcí (DRY)
          applyAlignmentStyles(img, newAlign);
          applyFloatStyles(img, newFloat);

          applyAlignmentStyles(container, newAlign);
          applyFloatStyles(container, newFloat);

          if (newFloat === 'left' || newFloat === 'right') {
            container.style.display = 'inline-block';
          } else {
            container.style.display = 'block';
          }

          return true;
        },

        // DŮLEŽITÉ: Cleanup event listenerů (oprava memory leak!)
        destroy: () => {
          resizeHandle.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          container.removeEventListener('mouseenter', handleMouseEnter);
          container.removeEventListener('mouseleave', handleMouseLeave);
        },
      };
    };
  },
});

export default ImageExtended;
