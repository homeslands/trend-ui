import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useTranslation } from "react-i18next";

import { HighlightMenu2, HighlightMenu3, HighlightMenu4, HighlightMenu5 } from '@/assets/images';

export default function HighlightMenuCarousel(): React.ReactElement {
    const { t } = useTranslation('home');
    
    const breakpoints = {
        0: { slidesPerView: 2, spaceBetween: 20 },
        768: { slidesPerView: 4, spaceBetween: 20 },
    }

    // Dữ liệu hardcode với 4 hình ảnh và tên món
    const highlightMenus = [
        { id: 1, image: HighlightMenu2, nameKey: 'home.highlightMenu.coffee' }, // Cà phê
        { id: 2, image: HighlightMenu3, nameKey: 'home.highlightMenu.tea' }, // Trà
        { id: 3, image: HighlightMenu4, nameKey: 'home.highlightMenu.smoothie' }, // Đá xay
        { id: 4, image: HighlightMenu5, nameKey: 'home.highlightMenu.food' } // Món ăn
    ];

    return (
        <Swiper
            breakpoints={breakpoints}
            initialSlide={0}
            spaceBetween={24}
            allowTouchMove={true}
            modules={[Autoplay, Pagination]}
            className="overflow-y-visible w-full h-full mySwiper"
            pagination={{ clickable: true }}
        >
            {highlightMenus.map((item) => (
                <SwiperSlide
                    key={item.id}
                    className="py-2 w-full h-[7rem] sm:h-[18rem]"
                >
                    <div className="flex h-full w-full flex-col justify-between">
                        <div className="relative w-full aspect-square">
                            <img
                                src={item.image}
                                alt={t(item.nameKey)}
                                className="w-full h-full object-cover rounded-xl"
                            />
                        </div>

                        {/* Tên món */}
                        <div className="mt-2 px-1">
                            <span className="text-center text-2xl text-primary line-clamp-1">
                                {t(item.nameKey)}
                            </span>
                        </div>
                    </div>
                </SwiperSlide>
            ))}
        </Swiper>
    )
}