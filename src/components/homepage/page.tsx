"use client"

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../navbar/page";
import Footer from "../footer/page";
import ProductFilter from "./ProductFilter";
import { useAppDispatch } from "../../redux/hooks";
import { addToCart } from "../../redux/slices/cartSlice";
import { toast } from "react-hot-toast";
import axios from "axios";
import { Search, ShoppingBag, ArrowRight, Star, ShoppingCart, TrendingUp, Heart } from "lucide-react";
import { addToWishlistLocal, removeFromWishlistLocal, setWishlist } from "../../redux/slices/wishlistSlice";
import { useAppSelector } from "../../redux/hooks";
import { useSession } from "next-auth/react";

const getGridItemClass = (index: number) => {
  // Balanced grid with occasional emphasized items for a premium gallery feel
  if (index === 0) return "md:col-span-2 md:row-span-2";
  return "col-span-1 row-span-1";
};

export default function Homepage() {
  const { status } = useSession();
  const dispatch = useAppDispatch();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  interface FilterState {
    minPrice: number;
    maxPrice: number;
    rating: number | null;
    mostSold: boolean;
    mostRated: boolean;
    category: string | null;
    sortByPrice: 'low-high' | 'high-low' | null;
  }

  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 1000000,
    rating: null,
    mostSold: false,
    mostRated: false,
    category: null,
    sortByPrice: null,
  });

  const fetchProducts = async (currentFilters = filters, search = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (currentFilters.category) params.append("category", currentFilters.category);
      if (currentFilters.minPrice) params.append("minPrice", currentFilters.minPrice.toString());
      if (currentFilters.maxPrice) params.append("maxPrice", currentFilters.maxPrice.toString());
      if (currentFilters.rating) params.append("minRating", currentFilters.rating.toString());

      let sort = "newest";
      if (currentFilters.mostSold) sort = "sold-desc";
      else if (currentFilters.mostRated) sort = "rating-desc";
      else if (currentFilters.sortByPrice === 'low-high') sort = "price-asc";
      else if (currentFilters.sortByPrice === 'high-low') sort = "price-desc";
      params.append("sort", sort);

      const response = await fetch(`/api/marketplace/products?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [absoluteMaxPrice, setAbsoluteMaxPrice] = useState(1000000);

  // Initial load to get metadata
  useEffect(() => {
    const loadInitialMetadata = async () => {
      try {
        const response = await fetch("/api/marketplace/products");
        const data = await response.json();
        if (data.success) {
          const cats = Array.from(new Set(data.products.map((p: any) => p.category || "General")));
          setAllCategories(cats as string[]);
          const max = data.products.length > 0 ? Math.max(...data.products.map((p: any) => p.price)) : 1000000;
          setAbsoluteMaxPrice(max);
          setProducts(data.products);
        }
        fetchWishlist();
      } catch (err) {
        console.error("Metadata load failed", err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialMetadata();
  }, [dispatch]);

  // Update products when search or filters change
  useEffect(() => {
    fetchProducts();
  }, [searchQuery, filters]);

  const filteredProducts = products; // Backend handles filtering now
  const wishlistItems = useAppSelector((state) => state.wishlist.items);

  const fetchWishlist = async () => {
    try {
      const response = await axios.get("/api/wishlist");
      if (response.data.success) {
        dispatch(setWishlist(response.data.data.map((item: any) => ({
          id: item.id,
          productId: item.productId.id,
          name: item.productId.name,
          price: item.productId.price,
          imageUrl: item.productId.image
        }))));
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        console.error("Wishlist fetch failed", err);
      }
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();

    const isInWishlist = wishlistItems.some((item) => item.productId === product.id);

    try {
      const res = await axios.post("/api/wishlist", { productId: product.id });
      if (res.data.success) {
        if (isInWishlist || res.data.removed) {
          dispatch(removeFromWishlistLocal(product.id));
        } else {
          dispatch(addToWishlistLocal({
            id: res.data.id || Math.random().toString(),
            productId: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.image
          }));
        }
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error("Please login to use wishlist");
      } else {
        toast.error("Failed to update wishlist");
      }
    }
  };

  const handleAddToCart = async (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (status !== "authenticated") {
      toast.error("Please create an account first!");
      return;
    }

    try {
      const res = await axios.post("/api/cart", { productId: product.id });
      if (res.data.success) {
        dispatch(addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.image
        }));
        toast.success(`${product.name} added to cart!`);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error("Please create an account first!");
      } else {
        toast.error(err.response?.data?.error || "Failed to add to cart");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-10 pb-10 lg:pt-32 lg:pb-32 overflow-x-clip">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full -z-10 opacity-50" />

        <div className="container mx-auto max-w-5xl text-center space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-1000 zoom-in-95 fill-mode-both">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm hover:scale-105 transition-transform duration-300 border border-primary/20 shadow-sm cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Season Sale Is Now Live
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground drop-shadow-sm">
            Curated Commerce <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500">
              For The Modern Era
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover a handpicked selection of premium goods from verified global merchants. Elevate your everyday style effortlessly.
          </p>

          <div className="relative max-w-2xl mx-auto flex items-center gap-4 mt-8 bg-background/80 backdrop-blur-xl p-2 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.01] border border-border/60 focus-within:ring-2 focus-within:ring-primary/50 transition-all duration-500 overflow-visible z-40">
            <div className="flex-1 flex items-center pl-4 gap-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products, categories, or brands..."
                className="w-full bg-transparent border-none outline-none text-foreground placeholder-muted-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="pr-2">
              <ProductFilter
                categories={allCategories}
                maxPrice={absoluteMaxPrice}
                onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Active Filters Display */}
      {(filters.category || filters.rating || filters.mostSold || filters.sortByPrice || (filters.maxPrice < absoluteMaxPrice && filters.maxPrice > 0)) && (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex flex-wrap items-center gap-2 p-3 bg-surface rounded-xl border border-border text-sm">
            <span className="text-muted-foreground font-medium mr-2">Active Filters:</span>
            {filters.category && (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full">{filters.category}</span>
            )}
            {filters.rating && (
              <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                {filters.rating}<Star className="w-3 h-3 fill-current" /> & Up
              </span>
            )}
            {filters.mostSold && (
              <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                <TrendingUp className="w-3 h-3" /> Bestsellers
              </span>
            )}
            <button
              onClick={() => setFilters({
                minPrice: 0,
                maxPrice: absoluteMaxPrice,
                rating: null,
                mostSold: false,
                mostRated: false,
                category: null,
                sortByPrice: null,
              })}
              className="px-3 py-1 text-muted-foreground hover:text-foreground underline underline-offset-4 ml-auto"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24 flex-1">
        <div className="flex items-center justify-center mb-12">
          <h2 className="text-3xl font-black text-foreground flex items-center gap-3 uppercase tracking-tighter">
            <ShoppingBag className="w-8 h-8 text-primary" />
            {searchTerm ? "Search Results" : "Featured Selection"}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={`skeleton-${i}`} className={`flex flex-col gap-4 bg-surface/50 rounded-[2rem] p-6 border border-border/50 animate-pulse ${getGridItemClass(i)}`}>
                <div className="w-full aspect-square bg-muted rounded-3xl" />
                <div className="h-6 bg-muted rounded-full w-3/4" />
                <div className="h-4 bg-muted rounded-full w-1/2" />
                <div className="h-10 bg-muted rounded-2xl w-full mt-auto" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-surface border border-dashed border-border rounded-[3rem]">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-8">
              <Search className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-3 tracking-tight">No products found</h3>
            <p className="text-muted-foreground max-w-md text-lg">
              We couldn't find any items matching your current filters. Try adjusting your search query.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setFilters({ minPrice: 0, maxPrice: absoluteMaxPrice, rating: null, mostSold: false, mostRated: false, category: null, sortByPrice: null });
              }}
              className="mt-8 px-10 py-4 bg-primary text-white rounded-full font-bold text-lg hover:bg-primary/90 hover:scale-105 transition-all shadow-xl shadow-primary/20"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            {filteredProducts.filter(p => p).map((product: any, i: number) => (
              <div
                key={`hp-prod-${product.id || i}-${i}`}
                style={{ animationDelay: `${(i % 10) * 100}ms` }}
                className={`group relative flex flex-col bg-surface/40 backdrop-blur-sm rounded-[2rem] overflow-hidden border border-border/50 hover:border-primary/40 transition-all duration-700 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-8 fill-mode-both ${getGridItemClass(i)}`}
              >
                {/* Image Showcase */}
                <Link 
                  href={`/products/productinfo?id=${product.id || product._id || ""}`}
                  className="relative aspect-square sm:aspect-[4/5] overflow-hidden bg-gradient-to-br from-muted/20 to-muted/50 p-6 sm:p-8"
                >
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-contain transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110 group-hover:rotate-2"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                       <ShoppingBag className="w-8 h-8" />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Image Coming Soon</span>
                    </div>
                  )}

                  {/* High-End Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                    {product.sold > 100 && (
                      <div className="bg-foreground text-background text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-tighter">
                        <TrendingUp className="w-3 h-3" /> Trending
                      </div>
                    )}
                    {Number(product.rating || 0) >= 4.8 && (
                      <div className="bg-amber-400 text-amber-950 text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-tighter">
                        <Star className="w-3 h-3 fill-current" /> Platinum
                      </div>
                    )}
                  </div>

                  {/* Floating Action Button (Wishlist) */}
                  <button
                    onClick={(e) => handleWishlistToggle(e, product)}
                    className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-background/80 backdrop-blur-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:scale-110 active:scale-90 transition-all shadow-xl group/heart"
                  >
                    <Heart
                      className={`w-5 h-5 transition-all duration-300 ${wishlistItems.some(item => item.productId === product.id)
                          ? "fill-destructive text-destructive scale-110"
                          : "group-hover/heart:scale-110"
                        }`}
                    />
                  </button>
                  
                  {/* Quick Preview Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-[2px] hidden sm:flex justify-center">
                     <div className="bg-white dark:bg-zinc-900 text-foreground text-[10px] font-black px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 uppercase tracking-widest border border-border/50">
                        View Details <ArrowRight className="w-3 h-3" />
                     </div>
                  </div>
                </Link>

                {/* Refined Content */}
                <div className="p-5 sm:p-7 flex flex-col flex-1 relative">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em] opacity-80">
                      {product.category || "Essential"}
                    </span>
                    <div className="flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                      <Star className="w-3 h-3 text-amber-500 fill-current" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        {Number(product.rating || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <Link href={`/products/productinfo?id=${product.id || product._id || ""}`} className="block group/title">
                    <h3 className="font-bold text-foreground text-base sm:text-xl leading-tight mb-2 line-clamp-2 transition-colors group-hover/title:text-primary tracking-tight">
                      {product.name}
                    </h3>
                  </Link>

                  <div className="mt-auto pt-5 border-t border-border/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block mb-0.5 opacity-60">Price</span>
                      <p className="font-black text-foreground flex items-baseline">
                        <span className="text-xs mr-1 text-primary">Rs.</span>
                        <span className="text-xl sm:text-2xl tracking-tighter">{product.price.toLocaleString()}</span>
                      </p>
                    </div>

                    <button 
                       onClick={(e) => handleAddToCart(e, product)}
                       className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25 group/cart"
                    >
                       <ShoppingCart className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modern CTA */}
      {status !== "authenticated" && (
        <section className="relative overflow-hidden py-24 bg-primary text-white mt-12">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Elevate your lifestyle today.</h2>
            <p className="text-primary-foreground/80 md:text-xl max-w-2xl mb-10">
              Join thousands of discerning shoppers and discover the perfect addition to your curated collection.
            </p>
            <Link
              href="/auth/signup"
              className="flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-full font-bold text-lg hover:bg-slate-50 hover:scale-105 transition-all shadow-xl hover:shadow-2xl"
            >
              Create Your Account <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
