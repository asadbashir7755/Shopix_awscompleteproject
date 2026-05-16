"use client";

import { useState, useEffect } from "react";
import { X, SlidersHorizontal, ArrowUpDown, Star, TrendingUp, RefreshCw, ChevronDown } from "lucide-react";

interface ProductFilterProps {
  categories: string[];
  onFilterChange: (filters: any) => void;
  maxPrice: number;
}

export default function ProductFilter({ categories, onFilterChange, maxPrice }: ProductFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [currentMaxPrice, setCurrentMaxPrice] = useState(maxPrice || 100000);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showMostSold, setShowMostSold] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortByPrice, setSortByPrice] = useState<'low-high' | 'high-low' | null>(null);

  useEffect(() => {
    if (maxPrice > 0 && currentMaxPrice === 0) {
      setCurrentMaxPrice(maxPrice);
    }
  }, [maxPrice]);

  const resetFilters = () => {
    setMinPrice(0);
    setCurrentMaxPrice(maxPrice || 100000);
    setSelectedRating(null);
    setShowMostSold(false);
    setSelectedCategory(null);
    setSortByPrice(null);
  };

  useEffect(() => {
    onFilterChange({
      minPrice,
      maxPrice: currentMaxPrice,
      rating: selectedRating,
      mostSold: showMostSold,
      category: selectedCategory,
      sortByPrice,
    });
  }, [minPrice, currentMaxPrice, selectedRating, showMostSold, selectedCategory, sortByPrice]);

  const activeFilterCount = [
    minPrice > 0,
    currentMaxPrice < (maxPrice || 100000),
    selectedRating !== null,
    showMostSold,
    selectedCategory !== null,
    sortByPrice !== null,
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl border-2 transition-all duration-300 font-bold text-sm shadow-sm ${
          isOpen || activeFilterCount > 0
          ? "border-primary bg-primary text-white shadow-primary/20"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary"
        }`}
      >
        <SlidersHorizontal className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${isOpen ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-500"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed lg:absolute bottom-0 lg:bottom-auto right-0 lg:right-0 lg:mt-4 w-full sm:w-[400px] bg-background lg:rounded-[2.5rem] rounded-t-[2.5rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] border border-border/60 overflow-hidden z-[110] transform transition-all animate-in slide-in-from-bottom-10 lg:slide-in-from-top-4 duration-500">
            
            {/* Header */}
            <div className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-surface/30">
               <div>
                  <h3 className="text-xl font-black text-foreground tracking-tight">Refine Collection</h3>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Found your perfect match</p>
               </div>
               <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors border border-border/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {/* Category Section */}
              <div className="space-y-4">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block">Categories</label>
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 ${selectedCategory === cat
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105"
                          : "bg-surface border-border text-muted-foreground hover:border-primary/50"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                </div>
              </div>

              {/* Price Range Section */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block">Price Threshold</label>
                  <div className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                    Up to Rs. {currentMaxPrice.toLocaleString()}
                  </div>
                </div>
                <div className="relative px-2">
                  <input
                    type="range"
                    min="0"
                    max={maxPrice || 100000}
                    step={Math.max((maxPrice || 100000) / 100, 1)}
                    value={currentMaxPrice}
                    onChange={(e) => setCurrentMaxPrice(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary border border-border/50"
                  />
                  <div className="flex justify-between mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span>Rs. 0</span>
                    <span>Rs. {(maxPrice || 100000).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Advanced Controls Row */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block">Sort Order</label>
                  <div className="flex gap-2">
                    <button
                        onClick={() => setSortByPrice(sortByPrice === 'low-high' ? null : 'low-high')}
                        className={`flex-1 aspect-square rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${sortByPrice === 'low-high' ? "bg-primary border-primary text-white shadow-lg" : "border-border bg-surface text-muted-foreground hover:border-primary/40"}`}
                        title="Price: Low to High"
                      >
                        <ArrowUpDown className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSortByPrice(sortByPrice === 'high-low' ? null : 'high-low')}
                        className={`flex-1 aspect-square rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${sortByPrice === 'high-low' ? "bg-primary border-primary text-white shadow-lg" : "border-border bg-surface text-muted-foreground hover:border-primary/40"}`}
                        title="Price: High to Low"
                      >
                        <ArrowUpDown className="w-5 h-5 rotate-180" />
                      </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block">Min Rating</label>
                  <div className="flex h-[44px] items-center justify-between bg-surface rounded-2xl border-2 border-border/50 px-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setSelectedRating(selectedRating === star ? null : star)}
                        className={`transition-all duration-300 hover:scale-125 ${selectedRating && selectedRating >= star ? "text-amber-400" : "text-muted-foreground opacity-30"}`}
                      >
                        <Star className={`w-5 h-5 ${selectedRating && selectedRating >= star ? "fill-current" : ""}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Special Filters */}
              <div className="pt-4">
                 <button
                    onClick={() => setShowMostSold(!showMostSold)}
                    className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all duration-500 ${showMostSold ? "bg-primary border-primary text-white shadow-xl shadow-primary/20" : "bg-surface border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    <div className="flex items-center gap-4">
                       <div className={`p-2 rounded-xl ${showMostSold ? 'bg-white/20' : 'bg-muted'}`}>
                          <TrendingUp className="w-5 h-5" />
                       </div>
                       <div className="text-left">
                          <p className="font-black text-sm uppercase tracking-tight">Bestsellers Only</p>
                          <p className={`text-[10px] ${showMostSold ? 'text-white/70' : 'text-muted-foreground'}`}>Show only most popular items</p>
                       </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${showMostSold ? 'border-white bg-white' : 'border-border'}`}>
                       {showMostSold && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </button>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-border/50 flex gap-4 bg-surface/30">
              <button
                onClick={resetFilters}
                className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all border border-border/40 group"
                title="Reset All Filters"
              >
                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-primary text-white font-black text-sm rounded-2xl py-4 shadow-xl shadow-primary/20 active:scale-[0.98] transition-all uppercase tracking-widest border border-primary"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
