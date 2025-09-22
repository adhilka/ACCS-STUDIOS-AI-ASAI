import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { BrandAssets, BrandingContextState } from '../types';

const BRAND_STORAGE_KEY = 'asai_brand_assets';

const defaultColors = {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#0ea5e9',
    neutral: '#6b7280',
    'base-content': '#ffffff',
    'base-100': '#111827',
    'base-200': '#1f2937',
    'base-300': '#374151',
};

const BrandingContext = createContext<BrandingContextState | undefined>(undefined);

const applyBrandStyles = (assets: BrandAssets) => {
    const root = document.documentElement;
    const styleElement = document.getElementById('brand-styles');

    // Apply colors
    Object.entries(assets.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
    });

    // Apply background
    root.style.setProperty('--image-background', `url(${assets.background})`);
    
    // Persist to local storage for style element
    if (styleElement) {
        let cssText = ':root {\n';
        Object.entries(assets.colors).forEach(([key, value]) => {
            cssText += `  --color-${key}: ${value};\n`;
        });
        cssText += `  --image-background: url(${assets.background});\n`;
        cssText += '}';
        styleElement.innerHTML = cssText;
    }
};

const resetBrandStyles = () => {
     const root = document.documentElement;
     const styleElement = document.getElementById('brand-styles');

    // Reset colors
    Object.entries(defaultColors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
    });
    
    // Reset background
    root.style.setProperty('--image-background', 'none');

    // Persist to local storage for style element
    if (styleElement) {
        let cssText = ':root {\n';
        Object.entries(defaultColors).forEach(([key, value]) => {
            cssText += `  --color-${key}: ${value};\n`;
        });
        cssText += `  --image-background: none;\n`;
        cssText += '}';
        styleElement.innerHTML = cssText;
    }
};


export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [brand, setBrand] = useState<BrandAssets | null>(null);

    useEffect(() => {
        try {
            const savedBrandJSON = localStorage.getItem(BRAND_STORAGE_KEY);
            if (savedBrandJSON) {
                const savedBrand = JSON.parse(savedBrandJSON);
                setBrand(savedBrand);
                applyBrandStyles(savedBrand);
            }
        } catch (error) {
            console.error("Failed to load brand from local storage:", error);
            localStorage.removeItem(BRAND_STORAGE_KEY);
        }
    }, []);

    const saveBrand = useCallback((assets: BrandAssets) => {
        setBrand(assets);
        localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(assets));
        applyBrandStyles(assets);
    }, []);

    const resetBrand = useCallback(() => {
        setBrand(null);
        localStorage.removeItem(BRAND_STORAGE_KEY);
        resetBrandStyles();
    }, []);

    return (
        <BrandingContext.Provider value={{ brand, saveBrand, resetBrand }}>
            {children}
        </BrandingContext.Provider>
    );
};

export const useBranding = (): BrandingContextState => {
    const context = useContext(BrandingContext);
    if (!context) {
        throw new Error('useBranding must be used within a BrandingProvider');
    }
    return context;
};