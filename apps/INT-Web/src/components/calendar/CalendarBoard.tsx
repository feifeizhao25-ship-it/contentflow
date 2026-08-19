                                                    {task.platforms.map((p: string) => (
                                                        <span key={p} className="text-xs">
                                                            {p === 'tiktok' && '🎵'}
                                                            {p === 'instagram' && '📸'}
                                                            {p === 'youtube' && '▶️'}
                                                            {(p === 'x' || p === 'twitter') && '𝕏'}
                                                            {p === 'linkedin' && '💼'}
                                                            {p === 'reddit' && '👽'}
                                                            {!['tiktok', 'instagram', 'youtube', 'x', 'twitter', 'linkedin', 'reddit'].includes(p) && '📱'}
                                                        </span>
                                                    ))}
