import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Image as ImageIcon, Search, CheckCircle2, X, Loader2, Save, ShoppingCart, Pill, Receipt, FileText } from 'lucide-react';
import visionService from '../services/visionService';
import toast from 'react-hot-toast';

const BuddyVision = () => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResults, setAnalysisResults] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef();

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result);
            reader.readAsDataURL(selectedFile);
            setAnalysisResults(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        try {
            const res = await visionService.analyzeImage(file);
            setAnalysisResults(res.data);
            toast.success("Analysis complete!");
        } catch (error) {
            toast.error("Analysis failed. Please try again.");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveItems = async () => {
        if (!analysisResults?.items?.length) return;
        setIsSaving(true);
        try {
            await visionService.saveReminders(analysisResults.items);
            toast.success(`Successfully saved ${analysisResults.items.length} items!`);
            setFile(null);
            setPreview(null);
            setAnalysisResults(null);
        } catch (error) {
            toast.error("Failed to save items.");
        } finally {
            setIsSaving(false);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'grocery': return <ShoppingCart size={24} color="#10b981" />;
            case 'medicine': return <Pill size={24} color="#ef4444" />;
            case 'bill': return <Receipt size={24} color="#3b82f6" />;
            default: return <FileText size={24} color="var(--primary-color)" />;
        }
    };

    return (
        <div className="vision-container">
            <div className="vision-header">
                <h1>Buddy Vision AI</h1>
                <p>Upload a grocery list, prescription, or any note and let Buddy handle the rest.</p>
            </div>

            <div className="vision-card-grid">
                {/* Upload Section */}
                <div className="vision-card upload-section">
                    <div className="section-title">
                        <Upload size={18} />
                        <h2>Upload & Preview</h2>
                    </div>

                    {!preview ? (
                        <div
                            className="drop-zone"
                            onClick={() => fileInputRef.current.click()}
                        >
                            <div className="drop-zone-content">
                                <div className="icon-circle">
                                    <ImageIcon size={32} />
                                </div>
                                <h3>Select an image</h3>
                                <p>Support JPG, PNG (Max 5MB)</p>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                hidden
                                accept="image/*"
                            />
                        </div>
                    ) : (
                        <div className="preview-area">
                            <div className="preview-image-wrapper">
                                <img src={preview} alt="Upload Preview" />
                                {isAnalyzing && (
                                    <motion.div
                                        className="scanner-overlay"
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    />
                                )}
                            </div>
                            <div className="preview-actions">
                                <button
                                    className="btn-outline"
                                    onClick={() => { setFile(null); setPreview(null); setAnalysisResults(null); }}
                                    disabled={isAnalyzing}
                                >
                                    <X size={16} /> Reset
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || analysisResults}
                                >
                                    {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                                    {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                <div className="vision-card results-section">
                    <div className="section-title">
                        <CheckCircle2 size={18} />
                        <h2>AI Extracted Items</h2>
                    </div>

                    {!analysisResults ? (
                        <div className="empty-results">
                            <Search size={48} opacity={0.2} />
                            <p>Upload and analyze an image to see results here.</p>
                        </div>
                    ) : (
                        <div className="results-content">
                            <div className="result-type-header">
                                {getTypeIcon(analysisResults.type)}
                                <div>
                                    <h3>{analysisResults.type.toUpperCase()}</h3>
                                    <p>{analysisResults.summary}</p>
                                </div>
                            </div>

                            <div className="items-list">
                                {analysisResults.items.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        className="item-row"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                    >
                                        <div className="item-info">
                                            <h4>{item.title}</h4>
                                            <p>{item.details}</p>
                                        </div>
                                        {(item.date || item.time) && (
                                            <div className="item-meta">
                                                <span>{item.date} {item.time}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>

                            <button
                                className="btn-primary full-width save-btn"
                                onClick={handleSaveItems}
                                disabled={isSaving || !analysisResults.items.length}
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Save to Reminders
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .vision-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .vision-header {
                    margin-bottom: 3rem;
                    text-align: left;
                }

                .vision-header h1 {
                    font-size: 2.5rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #fff 0%, var(--primary-color) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 0.5rem;
                }

                .vision-header p {
                    color: var(--text-sub);
                    font-size: 1.1rem;
                }

                .vision-card-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                }

                .vision-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    min-height: 500px;
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 1.5rem;
                    color: var(--text-main);
                }

                .section-title h2 {
                    font-size: 1rem;
                    font-weight: 700;
                }

                .drop-zone {
                    flex: 1;
                    border: 2px dashed rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: rgba(255, 255, 255, 0.02);
                }

                .drop-zone:hover {
                    border-color: var(--primary-color);
                    background: rgba(var(--primary-rgb), 0.05);
                }

                .drop-zone-content {
                    text-align: center;
                }

                .icon-circle {
                    width: 64px;
                    height: 64px;
                    background: rgba(var(--primary-rgb), 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1rem;
                    color: var(--primary-color);
                }

                .preview-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .preview-image-wrapper {
                    flex: 1;
                    position: relative;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .preview-image-wrapper img {
                    max-width: 100%;
                    max-height: 350px;
                    object-fit: contain;
                }

                .scanner-overlay {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    height: 4px;
                    background: var(--primary-color);
                    box-shadow: 0 0 15px var(--primary-color);
                    z-index: 10;
                }

                .preview-actions {
                    display: flex;
                    gap: 12px;
                }

                .empty-results {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: var(--text-sub);
                    gap: 1rem;
                }

                .result-type-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    margin-bottom: 2rem;
                }

                .result-type-header h3 {
                    font-size: 0.9rem;
                    color: var(--text-main);
                    letter-spacing: 0.1em;
                }

                .result-type-header p {
                    font-size: 0.8rem;
                    color: var(--text-sub);
                }

                .items-list {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: auto;
                }

                .item-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                }

                .item-info h4 {
                    font-size: 0.9rem;
                    color: var(--text-main);
                    margin-bottom: 2px;
                }

                .item-info p {
                    font-size: 0.75rem;
                    color: var(--text-sub);
                }

                .item-meta {
                    font-size: 0.7rem;
                    color: var(--primary-color);
                    font-weight: 700;
                    background: rgba(var(--primary-rgb), 0.1);
                    padding: 4px 8px;
                    border-radius: 6px;
                }

                .save-btn {
                    margin-top: 2rem;
                    padding: 1rem;
                }

                .full-width {
                    width: 100%;
                }

                @media (max-width: 900px) {
                    .vision-card-grid {
                        grid-template-columns: 1fr;
                    }
                    .vision-card {
                        min-height: auto;
                    }
                }
            `}</style>
        </div>
    );
};

export default BuddyVision;
