import React, {useState, useEffect} from 'react';
import {IconDeviceFloppy, IconArrowLeft, IconLoader} from '@tabler/icons-react';
import {createDebugLogger} from '@utils/debug';
import {showSuccess, showError} from '@utils/notifications';
import TiptapEditor from './components/TiptapEditor';

const logger = createDebugLogger('AdminCmsPageEditor');

function App({pageId}) {
    const isEdit = !!pageId;

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [contentTypes, setContentTypes] = useState([]);
    const [availableParents, setAvailableParents] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        content_type: 'page',
        status: 'draft',
        parent_id: '',
        meta: {},
    });

    const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit);

    // Load content types
    useEffect(() => {
        fetch('/admin/api/cms/content-types')
            .then(res => res.json())
            .then(types => {
                setContentTypes(types);
                logger.lifecycle('Content types loaded', {types});
            })
            .catch(error => {
                logger.error('Failed to load content types', error);
            });
    }, []);

    // Load available parent pages when content type changes
    useEffect(() => {
        if (!formData.content_type) return;

        const params = new URLSearchParams();
        params.append('content_type', formData.content_type);
        params.append('status', 'published');

        fetch(`/admin/api/cms/pages?${params}`)
            .then(res => res.json())
            .then(pages => {
                // Exclude current page from parent options
                const filtered = pages.filter(p => p.id !== pageId);
                setAvailableParents(filtered);
                logger.lifecycle('Available parents loaded', {count: filtered.length});
            })
            .catch(error => {
                logger.error('Failed to load parent pages', error);
            });
    }, [formData.content_type, pageId]);

    // Load page data if editing
    useEffect(() => {
        if (!isEdit) return;

        fetch(`/admin/api/cms/pages/${pageId}`)
            .then(res => res.json())
            .then(data => {
                setFormData({
                    title: data.title,
                    slug: data.slug,
                    excerpt: data.excerpt || '',
                    content: data.content,
                    content_type: data.content_type,
                    status: data.status,
                    parent_id: data.parent_id || '',
                    meta: data.meta || {},
                });
                setLoading(false);
                logger.lifecycle('Page loaded', {pageId, data});
            })
            .catch(error => {
                logger.error('Failed to load page', error);
                showError('Chyba při načítání stránky');
                window.location.href = '/admin/cms';
            });
    }, [pageId, isEdit]);

    // Auto-generate slug from title
    useEffect(() => {
        if (!slugManuallyEdited && formData.title) {
            const slug = generateSlug(formData.title);
            setFormData(prev => ({...prev, slug}));
        }
    }, [formData.title, slugManuallyEdited]);

    const generateSlug = (text) => {
        const map = {
            'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e',
            'í': 'i', 'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's',
            'ť': 't', 'ú': 'u', 'ů': 'u', 'ý': 'y', 'ž': 'z',
        };

        return text
            .toLowerCase()
            .replace(/[áčďéěíňóřšťúůýž]/g, char => map[char] || char)
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    const generateUrlPreview = () => {
        // Pokud má parent, vezmi jeho URL path a přidej slug
        if (formData.parent_id) {
            const parent = availableParents.find(p => p.id === parseInt(formData.parent_id));
            if (parent && parent.url_path) {
                return parent.url_path + '/' + (formData.slug || 'slug');
            }
        }

        // Jinak sestav URL z prefixu typu a slugu
        const parts = [];
        const selectedType = contentTypes.find(t => t.value === formData.content_type);
        if (selectedType && selectedType.url_prefix) {
            parts.push(selectedType.url_prefix);
        }
        parts.push(formData.slug || 'slug');

        return '/' + parts.join('/');
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const handleMetaChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            meta: {...prev.meta, [field]: value}
        }));
    };

    const handleSlugChange = (value) => {
        setSlugManuallyEdited(true);
        handleChange('slug', value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        logger.lifecycle('Saving page', {isEdit, formData});

        try {
            const url = isEdit
                ? `/admin/api/cms/pages/${pageId}`
                : '/admin/api/cms/pages';

            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const savedPage = await response.json();
                logger.lifecycle('Page saved successfully', savedPage);

                // Při vytvoření nové stránky přesměruj na edit s ID
                if (!isEdit && savedPage.id) {
                    window.location.href = `/admin/cms/edit/${savedPage.id}`;
                } else {
                    // Při editaci zůstaň na stejné stránce, jen zobraz notifikaci
                    showSuccess('Stránka byla úspěšně uložena');
                    setSaving(false);
                }
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save page');
            }
        } catch (error) {
            logger.error('Failed to save page', error);
            showError('Chyba při ukládání stránky: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-600 dark:text-gray-400">Načítání...</div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex-layout gap-6">
            <div className="card flex-1">
                <div className="space-y-6">
                    {/* Title & Slug */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Název *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="form__input w-full"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            URL slug *
                        </label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            className="form__input w-full font-mono text-sm"
                            required
                            placeholder="automaticky-generovany-slug"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            URL Preview: {generateUrlPreview()}
                        </p>
                    </div>

                    {/* Excerpt */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Perex / krátký popis (nepovinné)
                        </label>
                        <textarea
                            value={formData.excerpt}
                            onChange={(e) => handleChange('excerpt', e.target.value)}
                            className="form__input w-full"
                            rows="3"
                            placeholder="Krátký popis stránky..."
                        />
                    </div>

                    {/* Content editor */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Obsah *
                        </label>
                        <TiptapEditor
                            content={formData.content}
                            onChange={(html) => handleChange('content', html)}
                            pageId={pageId}
                        />
                    </div>
                </div>
            </div>
            <div>
                <div className="card w-64 space-y-4 sticky top-16">
                    {/* Type & Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Typ obsahu
                        </label>
                        <select
                            value={formData.content_type}
                            onChange={(e) => handleChange('content_type', e.target.value)}
                            className="form__select w-full"
                        >
                            {contentTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Stav
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="form__select w-full"
                        >
                            <option value="draft">Koncept</option>
                            <option value="published">Publikováno</option>
                            <option value="archived">Archivováno</option>
                            <option value="deleted">Smazáno</option>
                        </select>
                    </div>

                    {/* Parent Page */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nadřazená stránka (nepovinné)
                        </label>
                        <select
                            value={formData.parent_id}
                            onChange={(e) => handleChange('parent_id', e.target.value)}
                            className="form__select w-full"
                        >
                            <option value="">Bez nadřazené stránky (root)</option>
                            {availableParents.map(page => (
                                <option key={page.id} value={page.id}>
                                    {page.title} ({page.slug})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Vytvoří hierarchickou strukturu stránek
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="btn btn--primary w-full"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <IconLoader size={16} className="animate-spin"/>
                                Ukládám...
                            </>
                        ) : (
                            <>
                                <IconDeviceFloppy size={16}/>
                                Uložit
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}

export default App;
