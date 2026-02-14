import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Vlastní Image extension s resize funkcionalitou
 * - Čistý HTML výstup s width/height atributy (BEZ hacků!)
 * - data-align pro pozicování (left/center/right)
 * - data-float pro obtékání textem (left/right/none)
 * - Podpora prokliknutelného obrázku (obalení v <a> tagu)
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

// Bezpečné vytvoření SVG link ikony pro badge
const createLinkIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'white');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const paths = [
    'M9 15l6 -6',
    'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464',
    'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463',
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
      // Link atributy - interní, nerendují se jako HTML atributy na <img>
      'data-link-href': {
        default: null,
        parseHTML: element => {
          // Obrázek obalený v <a> tagu
          const parent = element.parentElement;
          if (parent && parent.tagName === 'A') {
            return parent.getAttribute('href');
          }
          return null;
        },
        renderHTML: () => ({}), // Zpracováno na úrovni nodu
      },
      'data-link-target': {
        default: null,
        parseHTML: element => {
          const parent = element.parentElement;
          if (parent && parent.tagName === 'A') {
            return parent.getAttribute('target') || null;
          }
          return null;
        },
        renderHTML: () => ({}), // Zpracováno na úrovni nodu
      },
    };
  },

  parseHTML() {
    return [
      // Obrázek obalený v odkazu: <a href="..."><img src="..."></a>
      {
        tag: 'a > img[src]',
      },
      // Běžný obrázek: <img src="...">
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const linkHref = node.attrs['data-link-href'];
    const linkTarget = node.attrs['data-link-target'];

    if (linkHref) {
      const linkAttrs = { href: linkHref };
      if (linkTarget) {
        linkAttrs.target = linkTarget;
      }
      return ['a', linkAttrs, ['img', mergeAttributes(HTMLAttributes)]];
    }

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

      setImageLink: (href, target) => ({ commands }) => {
        return commands.updateAttributes(this.name, {
          'data-link-href': href || null,
          'data-link-target': target || null,
        });
      },

      removeImageLink: () => ({ commands }) => {
        return commands.updateAttributes(this.name, {
          'data-link-href': null,
          'data-link-target': null,
        });
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

      // Link badge - vizuální indikátor odkazu
      const linkBadge = document.createElement('div');
      linkBadge.className = 'image-link-badge';
      linkBadge.style.cssText = `
        position: absolute;
        top: 4px;
        left: 4px;
        width: 22px;
        height: 22px;
        background: rgba(59, 130, 246, 0.9);
        border-radius: 4px;
        padding: 4px;
        display: ${node.attrs['data-link-href'] ? 'flex' : 'none'};
        align-items: center;
        justify-content: center;
        pointer-events: none;
      `;
      linkBadge.appendChild(createLinkIcon());

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
      container.appendChild(linkBadge);

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

          // Update link badge viditelnosti
          linkBadge.style.display = updatedNode.attrs['data-link-href'] ? 'flex' : 'none';

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
