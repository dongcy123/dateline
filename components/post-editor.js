// ==========================================
// PostEditor — 多图发布编辑器
// 支持多图上传 · AI 标题 · 正文 · 目标关联
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.PostEditor = ({ objectives, onPublish, onClose, initialImages }) => {
  // images: [{ previewUrl, file?, url?, uploading }]
  const [images, setImages] = React.useState(initialImages || []);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [objectiveId, setObjectiveId] = React.useState('');
  const [extracting, setExtracting] = React.useState(false);
  const fileRef = React.useRef(null);
  const { uploadImage, callAI, uid } = window.Kawa;

  // 上传单张图片
  const uploadOne = async (idx) => {
    const img = images[idx];
    if (!img?.file) return;
    setImages(prev => prev.map((p, i) => i === idx ? { ...p, uploading: true } : p));
    try {
      const url = await uploadImage(img.file);
      setImages(prev => prev.map((p, i) => i === idx ? { ...p, url, uploading: false, file: null } : p));
    } catch (err) {
      alert('上传失败: ' + (err.message || '请检查网络'));
      setImages(prev => prev.map((p, i) => i === idx ? { ...p, uploading: false, error: true } : p));
    }
  };

  // 批量上传所有未上传的图片
  const uploadAll = () => {
    images.forEach((img, i) => {
      if (img.file && !img.url && !img.uploading) uploadOne(i);
    });
  };

  // 初始化时自动上传
  React.useEffect(() => { uploadAll(); }, []);

  // 添加图片
  const handleAddImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newImgs = files.map(file => {
      const previewUrl = URL.createObjectURL(file);
      return { previewUrl, file, uploading: false, url: null };
    });
    setImages(prev => [...prev, ...newImgs]);
    // 等 state 更新后上传（用 setTimeout 确保 state 已更新）
    setTimeout(() => {
      newImgs.forEach((_, i) => {
        const idx = images.length + i;
        uploadOne(idx);
      });
    }, 100);
    if (fileRef.current) fileRef.current.value = '';
  };

  // 删除图片
  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  // AI 提取标题
  const handleExtract = async () => {
    if (!body.trim()) return;
    setExtracting(true);
    try {
      const { result } = await callAI(body, objectives);
      if (result?.ai_metadata?.task_title) setTitle(result.ai_metadata.task_title);
    } catch {}
    setExtracting(false);
  };

  // 发布
  const handlePublish = () => {
    const uploadedUrls = images.filter(i => i.url).map(i => i.url);
    if (!body.trim() && uploadedUrls.length === 0) return;
    const ev = {
      id: uid(),
      timeline_time: new Date().toISOString(),
      record_time: new Date().toISOString(),
      raw_content: body.trim() || (title || '图片记录'),
      type: 'note',
      status: 'pending',
      objective_id: objectiveId || undefined,
      ai_metadata: {
        task_title: title || body.slice(0, 18) || '笔记',
        progress_delta: 0,
        images: uploadedUrls,
      },
      image_url: uploadedUrls[0] || null,  // backward compat
    };
    onPublish(ev);
    onClose();
  };

  const uploading = images.some(i => i.uploading);
  const hasContent = body.trim() || images.some(i => i.url);

  const inputStyle = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    color: 'var(--text-primary)', fontFamily: 'inherit',
  };

  return React.createElement('div', {
    className: 'fixed inset-0 z-[75] flex items-start justify-center',
    style: { background: '#fff', overflowY: 'auto' },
  },
    React.createElement('div', {
      className: 'w-full max-w-lg mx-auto flex flex-col min-h-screen',
      style: { paddingBottom: 40 }
    },
      // ── 顶部栏 ──
      React.createElement('div', { key: 'bar', className: 'flex items-center justify-between px-4 pt-3 pb-2 sticky top-0 z-10',
        style: { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' } },
        React.createElement('button', { key: 'close', onClick: onClose,
          style: { fontSize: 28, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }
        }, '×'),
        React.createElement('div', { key: 'sp', style: { flex: 1 } }),
        React.createElement('button', { key: 'pub', onClick: handlePublish,
          disabled: !hasContent || uploading,
          style: {
            padding: '7px 20px', borderRadius: 20, border: 'none', cursor: hasContent && !uploading ? 'pointer' : 'default',
            fontSize: 14, fontWeight: 600,
            background: hasContent && !uploading ? 'var(--accent-400)' : 'rgba(0,0,0,0.06)',
            color: hasContent && !uploading ? '#fff' : 'var(--text-tertiary)',
          }
        }, uploading ? '上传中...' : '发布'),
      ),

      // ── 图片区（多图网格）──
      React.createElement('div', { key: 'imgs', style: { padding: '0 16px 12px' } },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 } },
          // 已有图片
          ...images.map((img, i) =>
            React.createElement('div', { key: i,
              style: { position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: '#f5f5f5' }
            },
              React.createElement('img', { src: img.previewUrl, alt: '',
                style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
              }),
              img.uploading && React.createElement('div', {
                style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              },
                React.createElement('span', { style: { color: '#fff', fontSize: 12 } }, '↑'),
              ),
              img.error && React.createElement('div', {
                style: { position: 'absolute', inset: 0, background: 'rgba(196,128,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              },
                React.createElement('span', { style: { color: '#fff', fontSize: 12 } }, '失败'),
              ),
              React.createElement('button', { key: 'x',
                onClick: () => removeImage(i),
                style: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              }, '×'),
            )
          ),
          // 添加按钮
          React.createElement('button', { key: 'add',
            onClick: () => fileRef.current?.click(),
            style: {
              aspectRatio: '1', borderRadius: 10, border: '2px dashed rgba(0,0,0,0.1)',
              background: 'rgba(0,0,0,0.02)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }
          },
            React.createElement('span', { key: 'ic', style: { fontSize: 24 } }, '📷'),
            React.createElement('span', { key: 'tx', style: { fontSize: 10, color: 'var(--text-tertiary)' } }, images.length === 0 ? '添加图片' : '再加'),
          ),
        ),
        React.createElement('input', { key: 'file', ref: fileRef, type: 'file', accept: 'image/*', multiple: true,
          style: { display: 'none' }, onChange: handleAddImages }),
      ),

      // ── 标题 ──
      React.createElement('div', { key: 'title-wrap', style: { padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('input', { key: 't', type: 'text', value: title, onChange: e => setTitle(e.target.value),
          placeholder: '标题（可选）',
          style: { ...inputStyle, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', flex: 1 }
        }),
        React.createElement('button', { key: 'ai', onClick: handleExtract, disabled: extracting || !body.trim(),
          style: {
            fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 9999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: extracting ? 'rgba(0,0,0,0.04)' : 'var(--accent-100)',
            color: extracting ? 'var(--text-tertiary)' : 'var(--accent-500)',
          }
        }, extracting ? '...' : '✨ AI 提炼'),
      ),

      // ── 正文 ──
      React.createElement('div', { key: 'body-wrap', style: { padding: '0 16px 16px', flex: 1 } },
        React.createElement('textarea', { key: 'b', value: body, onChange: e => setBody(e.target.value),
          placeholder: '写点什么...',
          rows: 10,
          style: { ...inputStyle, fontSize: 15, lineHeight: 1.7, resize: 'none', minHeight: 200 }
        }),
      ),

      // ── 目标关联 ──
      React.createElement('div', { key: 'obj-wrap', style: { padding: '0 16px 16px' } },
        React.createElement('label', { key: 'l', style: { fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' } }, '关联目标'),
        React.createElement('div', { key: 'tags', style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          React.createElement('button', { key: 'none', onClick: () => setObjectiveId(''),
            style: {
              fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 9999, border: 'none', cursor: 'pointer',
              background: objectiveId === '' ? 'var(--accent-400)' : 'rgba(0,0,0,0.04)',
              color: objectiveId === '' ? '#fff' : 'var(--text-secondary)',
            }
          }, '无'),
          ...objectives.map(o => React.createElement('button', { key: o.id, onClick: () => setObjectiveId(o.id),
            style: {
              fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 9999, border: 'none', cursor: 'pointer',
              background: objectiveId === o.id ? o.color : o.color + '14',
              color: objectiveId === o.id ? '#fff' : o.color,
            }
          }, o.title)),
        ),
      ),

      // ── 底部发布 ──
      React.createElement('div', { key: 'pub-bottom', style: { padding: '0 16px' } },
        React.createElement('button', { key: 'pb', onClick: handlePublish,
          disabled: !hasContent || uploading,
          style: {
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            cursor: hasContent && !uploading ? 'pointer' : 'default',
            fontSize: 16, fontWeight: 600,
            background: hasContent && !uploading ? 'var(--accent-400)' : 'rgba(0,0,0,0.05)',
            color: hasContent && !uploading ? '#fff' : 'var(--text-tertiary)',
          }
        }, '发布笔记'),
      ),
    )
  );
};
