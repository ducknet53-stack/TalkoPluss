import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Story } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface StoryViewerProps {
  stories: Story[];
  initialUserIndex: number;
  onClose: () => void;
}

const TEXT_STYLE_CLASSES: Record<string, string> = {
  sans: 'font-sans',
  serif: 'font-serif italic',
  mono: 'font-mono',
  handwriting: 'font-cursive font-medium',
  impact: 'font-sans font-black uppercase tracking-wider'
};

export default function StoryViewer({ stories, initialUserIndex, onClose }: StoryViewerProps) {
  // Group stories by userId
  const groupedStories: Record<string, Story[]> = {};
  stories.forEach(story => {
    if (!groupedStories[story.userId]) {
      groupedStories[story.userId] = [];
    }
    groupedStories[story.userId].push(story);
  });

  // Sort each user's stories by timestamp ascending
  const userIds = Object.keys(groupedStories);
  userIds.forEach(uid => {
    groupedStories[uid].sort((a, b) => a.createdAt - b.createdAt);
  });

  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFullImageLoaded, setIsFullImageLoaded] = useState(false);

  const activeUserId = userIds[userIndex];
  const activeUserStories = groupedStories[activeUserId] || [];
  const activeStory = activeUserStories[storyIndex];

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const STORY_DURATION = 5000; // 5 seconds

  const nextStory = () => {
    if (storyIndex < activeUserStories.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (userIndex < userIds.length - 1) {
      setUserIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      setUserIndex(prev => prev - 1);
      const prevUserStories = groupedStories[userIds[userIndex - 1]] || [];
      setStoryIndex(prevUserStories.length - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    setProgress(0);
    if (!activeStory) return;

    setIsFullImageLoaded(false);

    const img = new Image();
    img.src = activeStory.imageUrl;
    img.onload = () => {
      setIsFullImageLoaded(true);
    };
  }, [userIndex, storyIndex, activeStory?.imageUrl]);

  useEffect(() => {
    // Progress interval (100ms interval for smooth progression)
    const step = 100;
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          nextStory();
          return 0;
        }
        return prev + (step / STORY_DURATION) * 100;
      });
    }, step);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [userIndex, storyIndex]);

  if (!activeStory) {
    return null;
  }

  const selectedStyleClass = TEXT_STYLE_CLASSES[activeStory.textStyle] || 'font-sans';

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center select-none">
      {/* Background Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20 pointer-events-none transition-all duration-500" 
        style={{ backgroundImage: `url(${isFullImageLoaded ? activeStory.imageUrl : (activeStory.thumbnailUrl || activeStory.imageUrl)})` }}
      />

      {/* Main Container */}
      <div className="relative w-full max-w-md aspect-[9/16] bg-black md:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl z-10 border border-white/5">
        
        {/* Navigation Overlays */}
        <div className="absolute inset-0 flex">
          <div 
            onClick={prevStory} 
            className="w-1/3 h-full cursor-pointer z-20" 
            title="Önceki"
          />
          <div 
            onClick={nextStory} 
            className="w-2/3 h-full cursor-pointer z-20" 
            title="Sonraki"
          />
        </div>

        {/* Stories Progress Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 flex gap-1 z-30 bg-gradient-to-b from-black/80 to-transparent">
          {activeUserStories.map((story, idx) => {
            let width = '0%';
            if (idx < storyIndex) {
              width = '100%';
            } else if (idx === storyIndex) {
              width = `${progress}%`;
            }
            return (
              <div key={story.id} className="h-[3px] bg-white/20 rounded-full flex-1 overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-100 ease-linear rounded-full"
                  style={{ width }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Owner Header */}
        <div className="absolute top-5 left-0 right-0 px-4 py-3 flex items-center justify-between z-30 bg-gradient-to-b from-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500 overflow-hidden bg-gray-800">
              {activeStory.userPhotoURL ? (
                <img src={activeStory.userPhotoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white bg-blue-600 font-bold text-sm">
                  {activeStory.username.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-sm text-white">{activeStory.username}</p>
              <p className="text-[10px] text-gray-300 font-medium">
                {formatDistanceToNow(activeStory.createdAt, { addSuffix: true, locale: tr })}
              </p>
            </div>
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors z-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Story Photo and Text */}
        <div className="flex-1 flex items-center justify-center relative w-full h-full bg-black">
          {/* 1. Low quality thumbnail (loaded instantly) */}
          <img 
            src={activeStory.thumbnailUrl || activeStory.imageUrl} 
            alt="Story Thumbnail" 
            className="w-full h-full object-cover select-none pointer-events-none absolute inset-0 filter blur-xs scale-105" 
          />

          {/* 2. High quality original (faded in once fully loaded) */}
          <img 
            src={activeStory.imageUrl} 
            alt="Story Content" 
            className={`w-full h-full object-cover select-none pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out ${
              isFullImageLoaded ? 'opacity-100' : 'opacity-0'
            }`} 
          />

          {/* Styled Text Overlay */}
          {activeStory.text && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/10 text-center select-none pointer-events-none z-10">
              <p 
                style={{ color: activeStory.textColor }}
                className={`text-center break-words text-xl md:text-2xl font-black select-none tracking-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] max-w-full ${selectedStyleClass}`}
              >
                {activeStory.text}
              </p>
            </div>
          )}
        </div>

        {/* Desktop Side Navigation Buttons */}
        <div className="absolute inset-y-0 -left-16 hidden md:flex items-center z-30">
          {userIndex > 0 || storyIndex > 0 ? (
            <button 
              onClick={prevStory}
              className="p-3 bg-gray-900/60 hover:bg-gray-900/90 hover:scale-105 border border-white/10 text-white rounded-full transition-all"
            >
              <ChevronLeft size={24} />
            </button>
          ) : null}
        </div>

        <div className="absolute inset-y-0 -right-16 hidden md:flex items-center z-30">
          {userIndex < userIds.length - 1 || storyIndex < activeUserStories.length - 1 ? (
            <button 
              onClick={nextStory}
              className="p-3 bg-gray-900/60 hover:bg-gray-900/90 hover:scale-105 border border-white/10 text-white rounded-full transition-all"
            >
              <ChevronRight size={24} />
            </button>
          ) : null}
        </div>

      </div>
    </div>
  );
}
