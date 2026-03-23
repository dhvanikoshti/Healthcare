const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminHealthTips.jsx', 'utf8');

// 1. Add state
content = content.replace(
  "const [imagePreview, setImagePreview] = useState(null);",
  "const [imagePreview, setImagePreview] = useState(null);\n  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });\n  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });"
);

// 2. Add showToastMessage
content = content.replace(
  "const [sections, setSections] = useState([\n    { id: 1, title: '', content: '' }\n  ]);",
  "const [sections, setSections] = useState([\n    { id: 1, title: '', content: '' }\n  ]);\n\n  const showToastMessage = (message, type = 'success') => {\n    setToast({ show: true, message, type });\n    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);\n  };"
);

// 3. Update handleSave
content = content.replace(
  "setHealthTips([newTip, ...healthTips]);",
  "setHealthTips([newTip, ...healthTips]);\n      showToastMessage('Health tip added successfully!', 'success');"
);
content = content.replace(
  "readTime: tip.readTime || '5 min read'\n      } : tip));",
  "readTime: tip.readTime || '5 min read'\n      } : tip));\n      showToastMessage('Health tip updated successfully!', 'success');"
);

// 4. Update handleDelete
content = content.replace(
  "const handleDelete = (id) => {\n    if (window.confirm('Are you sure you want to delete this health tip?')) {\n      setHealthTips(healthTips.filter(tip => tip.id !== id));\n    }\n  };",
  "const triggerDelete = (id) => {\n    setDeleteConfirm({ show: true, id });\n  };\n\n  const confirmDelete = () => {\n    if (deleteConfirm.id) {\n      setHealthTips(healthTips.filter(tip => tip.id !== deleteConfirm.id));\n      showToastMessage('Health tip deleted successfully!', 'success');\n    }\n    setDeleteConfirm({ show: false, id: null });\n  };"
);

// 5. Replace handleDelete calls with triggerDelete
content = content.replaceAll("handleDelete(selectedTip.id)", "triggerDelete(selectedTip.id)");
content = content.replaceAll("handleDelete(tip.id)", "triggerDelete(tip.id)");

// 6. Update Image Preview UI
content = content.replace(
  "{(imagePreview || formData.image) && (\n                      <div className=\"relative rounded-2xl overflow-hidden border-2 border-gray-200 mt-4 h-64 md:h-80 shadow-md group\">\n                        <img src={imagePreview || formData.image} alt=\"Preview\" className=\"w-full h-full object-cover\" />\n                        <div className=\"absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center\">\n                          <button type=\"button\" onClick={() => { setImagePreview(null); setFormData({ ...formData, image: '' }); }} className=\"px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 hover:scale-105 transition-all flex items-center gap-2\">\n                            <svg className=\"w-5 h-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16\" /></svg>\n                            Remove Image\n                          </button>\n                        </div>\n                      </div>\n                    )}",
  "{(imagePreview || formData.image) && (\n                      <div className=\"mt-4 flex flex-col items-end gap-3\">\n                        <div className=\"w-full rounded-2xl overflow-hidden border-2 border-gray-200 h-64 md:h-80 shadow-md\">\n                          <img src={imagePreview || formData.image} alt=\"Preview\" className=\"w-full h-full object-cover\" />\n                        </div>\n                        <button type=\"button\" onClick={() => { setImagePreview(null); setFormData({ ...formData, image: '' }); }} className=\"px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 text-sm shadow-sm\">\n                          <svg className=\"w-4 h-4\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16\" /></svg>\n                          Remove Image\n                        </button>\n                      </div>\n                    )}"
);

// 7. Insert Top-level modals
const modalUI = `
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[70] animate-fade-in-up">
          <div className={\`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 \${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}\`}>
            {toast.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, id: null })}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl scale-100 transition-all">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-2">Delete Health Tip</h3>
            <p className="text-center text-gray-500 mb-8 max-w-xs mx-auto">Are you sure you want to delete this tip? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm({ show: false, id: null })} className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all hover:-translate-y-0.5">Delete</button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace("</AdminLayout>", modalUI + "\n    </AdminLayout>");

fs.writeFileSync('src/pages/AdminHealthTips.jsx', content);
console.log("Updated smoothly");
