import React from 'react';

const PostCard = ({ type = "text", author, time, location, content, image, code, link, likes, comments }) => {
  const renderContent = () => {
    if (type === "image" && image) {
      return (
        <div className="relative aspect-video overflow-hidden">
          <img 
            alt={image.alt || "Post image"} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
            src={image.src}
          />
          <div className="absolute bottom-2 right-2 bg-background-dark/80 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-400 border border-terminal-border">
            {image.format} • {image.size}
          </div>
        </div>
      );
    }
    
    if (type === "code" && code) {
      return (
        <div className="bg-black/30 p-4 rounded-lg font-mono text-xs text-primary/80 border border-terminal-border/40">
          {code.map((line, index) => (
            <p key={index} className={line.comment ? "text-slate-400" : ""}>
              {line.text}
            </p>
          ))}
        </div>
      );
    }
    
    if (type === "link" && link) {
      return (
        <div className="flex gap-4">
          <div className="w-24 h-24 flex-shrink-0 bg-background-dark rounded border border-terminal-border overflow-hidden">
            <img 
              alt={link.imageAlt || "Link preview"} 
              className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all" 
              src={link.imageSrc}
            />
          </div>
          <div className="flex flex-col justify-between py-1">
            <div>
              <h3 className="text-sm font-bold text-slate-200 group-hover:text-primary transition-colors">{link.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{link.description}</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-600 uppercase tracking-tight">
              <span>{link.readTime}</span>
              <span>•</span>
              <span>@{link.author}</span>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <article className={`group bg-terminal-gray rounded-lg overflow-hidden border border-terminal-border hover:border-primary/30 transition-all duration-300 ${type === 'link' ? 'p-3' : ''}`}>
      <div className={`p-4 flex items-center justify-between ${type === 'link' ? '' : 'border-b border-terminal-border/30'}`}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-sm text-primary">
              {type === 'image' ? 'token' : type === 'code' ? 'data_object' : 'article'}
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">@{author}</p>
            <p className="text-[10px] text-slate-500">{time} • {location}</p>
          </div>
        </div>
        {type !== 'link' && (
          <button className="text-slate-500 hover:text-slate-300">
            <span className="material-symbols-outlined text-xl">more_vert</span>
          </button>
        )}
      </div>
      
      {renderContent()}
      
      {type !== 'link' && content && (
        <div className="p-4 space-y-2">
          <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
        </div>
      )}
      
      {type !== 'link' && (
        <div className="p-4 pt-4 flex items-center gap-6">
          <button className="flex items-center gap-1.5 text-slate-500 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">favorite</span>
            <span className="text-xs">{likes}</span>
          </button>
          <button className="flex items-center gap-1.5 text-slate-500 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">chat_bubble</span>
            <span className="text-xs">{comments}</span>
          </button>
          <button className="flex items-center gap-1.5 text-slate-500 hover:text-primary transition-colors ml-auto">
            <span className="material-symbols-outlined text-lg">share</span>
          </button>
        </div>
      )}
    </article>
  );
};

export default PostCard;
