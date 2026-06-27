// ==========================================
// PostEditor — 小红书风格发布编辑器
// 图片上传 · AI 标题 · 正文编辑 · 目标关联
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.PostEditor = ({ objectives, onPublish, onClose }) => {
  const [image, setImage] = React.useState(null);    // { file, previewUrl }
  const [imageUrl, setImageUrl] = React.useState(''); // uploaded URL
  const [uploading, setUploading] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [objectiveId, setObjectiveId] = React.useState('');
  const [extracting, setExtracting] = React.useState(false);
  const fileRef = React.useRef(null);
  const { uploadImage, callAI, uid } = window.Kawa;

  // 选择图片 → 自动上传
  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); return; }

    // 本地预览
    const reader = new FileReader();
    reader.onload = () => setImage({ file, previewUrl: reader.result });
    reader.readAsDataURL(file);

    // 上传
    setUploading(true);
    uploadImage(file).then(url => {
      setImageUrl(url);
      setUploading(false);
    }).catch(err => {
      alert('上传失败: ' + (err.message || '请检查网络'));
      setUploading(false);
    });
  };

  // AI 提取标题
  const handleExtract = async () => {
    if (!body.trim()) return;
    setExtracting(true);
    try {
      const { result } = await callAI(body, objectives);
      if (result?.ai_metadata?.task_title) {
        setTitle(result.ai_metadata.task_title);
      }
    } catch {}
    setExtracting(false);
  };

  // 发布
  const handlePublish = () => {
    if (!body.trim() && !imageUrl) return;
    const ev = {
      id: uid(),
      timeline_time: new Date().toISOString(),
      record_time: new Date().toISOString(),
      raw_content: body.trim() || (title || '图片记录'),
      type: 'note',
      status: 'pending',
      objective_id: objectiveId || undefined,
      ai_metadata: { task_title: title || body.slice(0, 18) || '笔记', progress_delta: 0 },
      image_url: imageUrl || null,
    };
    onPublish(ev);
    onClose();
  };

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
          disabled: !body.trim() && !imageUrl,
          style: {
            padding: '7px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
            background: (body.trim() || imageUrl) ? 'var(--accent-400)' : 'rgba(0,0,0,0.06)',
            color: (body.trim() || imageUrl) ? '#fff' : 'var(--text-tertiary)',
          }
        }, '发布'),
      ),

      // ── 图片区 ──
      React.createElement('div', { key: 'img', style: { padding: '0 16px 12px' } },
        image
          ? React.createElement('div', { style: { position: 'relative', borderRadius: 12, overflow: 'hidden' } },
              React.createElement('img', { src: image.previewUrl, alt: 'preview',
                style: { width: '100%', display: 'block', maxHeight: 360, objectFit: 'contain', background: '#f5f5f5' }
              }),
              uploading && React.createElement('div', {
                style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              },
                React.createElement('span', { style: { color: '#fff', fontSize: 14 } }, '上传中...')
              ),
              React.createElement('button', { key: 'del-img',
                onClick: () => { setImage(null); setImageUrl(''); },
                style: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
              }, '×'),
            )
          : React.createElement('button', { key: 'add-img',
              onClick: () => fileRef.current?.click(),
              style: {
                width: '100%', height: 160, borderRadius: 12, border: '2px dashed rgba(0,0,0,0.1)',
                background: 'rgba(0,0,0,0.02)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              }
            },
              React.createElement('span', { key: 'icon', style: { fontSize: 32 } }, '📷'),
              React.createElement('span', { key: 'txt', style: { fontSize: 13, color: 'var(--text-tertiary)' } }, '添加图片'),
            ),
        React.createElement('input', { key: 'file', ref: fileRef, type: 'file', accept: 'image/*',
          style: { display: 'none' }, onChange: handlePickImage }),
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
          React.createElement('button', { key: 'none',
            onClick: () => setObjectiveId(''),
            style: {
              fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 9999, border: 'none', cursor: 'pointer',
              background: objectiveId === '' ? 'var(--accent-400)' : 'rgba(0,0,0,0.04)',
              color: objectiveId === '' ? '#fff' : 'var(--text-secondary)',
            }
          }, '无'),
          ...objectives.map(o => React.createElement('button', { key: o.id,
            onClick: () => setObjectiveId(o.id),
            style: {
              fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 9999, border: 'none', cursor: 'pointer',
              background: objectiveId === o.id ? o.color : o.color + '14',
              color: objectiveId === o.id ? '#fff' : o.color,
            }
          }, o.title)),
        ),
      ),

      // ── 发布按钮（底部）──
      React.createElement('div', { key: 'pub-bottom', style: { padding: '0 16px' } },
        React.createElement('button', { key: 'pb', onClick: handlePublish,
          disabled: !body.trim() && !imageUrl,
          style: {
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
            fontSize: 16, fontWeight: 600,
            background: (body.trim() || imageUrl) ? 'var(--accent-400)' : 'rgba(0,0,0,0.05)',
            color: (body.trim() || imageUrl) ? '#fff' : 'var(--text-tertiary)',
          }
        }, '发布笔记'),
      ),
    )
  );
};
