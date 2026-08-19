import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTE } from '@/constants'
import { NewsArticle11, NewsArticle12, NewsArticle13, NewsArticle21, NewsArticle22, NewsArticle23, NewsArticle31, NewsArticle32, NewsArticle33, NewsArticle34 } from '@/assets/images'
import type { NewsArticleDetail } from '../types'

const mockNewsArticles: Record<string, NewsArticleDetail> = {
  'bai-viet-1': {
    id: '1',
    slug: 'bai-viet-1',
    title: 'Tổ Chức Sự Kiện Acoustic Hằng Tuần Tại Trend Coffee – Không Gian Chill Cho Cuối Tuần Thư Thái',
    summary: 'Bạn đang tìm một nơi để thư giãn, nghe nhạc sống và tận hưởng không gian cà phê ấm cúng sau những ngày làm việc căng thẳng? Trend Coffee & Foods chính là điểm hẹn lý tưởng với sự kiện Acoustic hằng tuần – nơi âm nhạc, cà phê và cảm xúc hòa quyện trong một trải nghiệm trọn vẹn.',
    thumbnail: NewsArticle11,
    publishDate: '2025-11-27',
    contentBlocks: [
      {
        type: 'paragraph',
        content: 'Bạn đang tìm một nơi để thư giãn, nghe nhạc sống và tận hưởng không gian cà phê ấm cúng sau những ngày làm việc căng thẳng? Trend Coffee & Foods chính là điểm hẹn lý tưởng với sự kiện Acoustic hằng tuần – nơi âm nhạc, cà phê và cảm xúc hòa quyện trong một trải nghiệm trọn vẹn.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle11,
      },
      {
        type: 'heading',
        content: 'Acoustic Night – Dấu Ấn Riêng Của Trend Coffee',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Tại Trend Coffee, âm nhạc không chỉ là chất xúc tác cảm xúc mà còn là một phần của phong cách sống. Vì vậy, chúng tôi tổ chức Acoustic Night vào mỗi cuối tuần, mang đến không gian thư thái, nhẹ nhàng nhưng vẫn đầy cảm hứng.',
      },
      {
        type: 'paragraph',
        content: 'Mỗi buổi diễn là một màu sắc riêng:',
      },
      {
        type: 'paragraph',
        content: '• Giọng hát mộc mạc, gần gũi\n• Giai điệu chill, dễ nghe\n• Phong cách trình diễn thân thiện, kết nối với khách',
      },
      {
        type: 'paragraph',
        content: 'Đây là điểm nhấn khiến việc ghé Trend Coffee vào tối cuối tuần trở thành một "nghi thức" của nhiều khách quen.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle12,
      },
      {
        type: 'heading',
        content: 'Không Gian Rustic – Chill – Ấm Áp',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Trend Coffee được thiết kế theo phong cách rustic hiện đại, kết hợp gỗ, ánh vàng và mùi cà phê rang thơm nhẹ. Khi acoustic vang lên, mọi thứ hòa hợp tạo thành một trải nghiệm đậm chất nghệ thuật và cảm xúc.',
      },
      {
        type: 'heading',
        content: 'Lịch Acoustic Hằng Tuần',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Để phục vụ tốt hơn nhu cầu của khách hàng, Trend Coffee tổ chức định kỳ hằng tuần, cụ thể:',
      },
      {
        type: 'paragraph',
        content: '• Thời gian: 19h30 – 21h00\n• Ngày tổ chức: Hằng tuần (tùy tuần, cập nhật ngày cụ thể trên fanpage Trend Coffee)\n• Địa điểm: Trend Coffee & Foods – 03 Nguyễn Công Trứ, Bình Thọ, Thủ Đức',
      },
      {
        type: 'paragraph',
        content: 'Khách có thể đặt bàn trước để giữ vị trí đẹp, đặc biệt là các bàn gần sân khấu.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle13,
      },
      {
        type: 'heading',
        content: 'Những Lợi Ích Khi Tham Gia Acoustic Night tại Trend Coffee',
        level: 2,
      },
      {
        type: 'heading',
        content: 'Thư giãn thật sự sau một tuần bận rộn',
        level: 3,
      },
      {
        type: 'paragraph',
        content: 'Không ồn ào, không náo nhiệt – acoustic nhẹ nhàng giúp tâm trạng thoải mái hơn.',
      },
      {
        type: 'heading',
        content: 'Địa điểm lý tưởng để hẹn hò hoặc gặp gỡ bạn bè',
        level: 3,
      },
      {
        type: 'paragraph',
        content: 'Âm nhạc giúp cuộc trò chuyện trở nên tự nhiên và cảm xúc hơn.',
      },
      {
        type: 'heading',
        content: 'Trải nghiệm cà phê và món ăn chất lượng',
        level: 3,
      },
      {
        type: 'paragraph',
        content: 'Ngoài âm nhạc ra, Trend Coffee còn phục vụ:',
      },
      {
        type: 'paragraph',
        content: '• Cà phê rang xay chuẩn vị\n• Trà – nước ép – đá xay phong phú\n• Bánh ngọt và các món ăn được chuẩn bị tỉ mỉ',
      },
      {
        type: 'heading',
        content: 'Check-in cực chill',
        level: 3,
      },
      {
        type: 'paragraph',
        content: 'Không gian rustic + ánh đèn vàng + sân khấu nhỏ = bộ ảnh "nghệ" không cần chỉnh nhiều.',
      },
      {
        type: 'heading',
        content: 'Đặt Lịch – Theo Dõi – Đồng Hành',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Để cập nhật lịch diễn mỗi tuần, bạn có thể:',
      },
      {
        type: 'paragraph',
        content: '• Theo dõi Fanpage Trend Coffee & Foods\n• Đặt bàn qua tin nhắn hoặc hotline\n• Theo dõi website để cập nhật các sự kiện đặc biệt',
      },
      {
        type: 'paragraph',
        content: 'Ngoài Acoustic Night, Trend Coffee cũng tổ chức nhiều hoạt động hấp dẫn khác: workshop, sự kiện theo mùa, mini live session, phù hợp với từng nhóm khách hàng.',
      },
      {
        type: 'paragraph',
        content: 'Sự kiện Acoustic hằng tuần tại Trend Coffee không chỉ là một buổi nghe nhạc, mà là không gian để mọi người tạm gác lại sự bộn bề, tìm lại cảm hứng và tận hưởng những giai điệu mộc mạc. Nếu bạn đang tìm một nơi chill đúng nghĩa, hãy ghé Trend Coffee vào mỗi cuối tuần để cảm nhận sự khác biệt.',
      },
      {
        type: 'paragraph',
        content: 'Trend Coffee & Foods – Tận tình trong từng sản phẩm, trọn vẹn trong từng trải nghiệm.',
      },
      {
        type: 'paragraph',
        content: 'Hãy ghé Trend Coffee để cảm nhận sự kết hợp hài hòa giữa âm nhạc và hương vị. Chúng tôi tin rằng mỗi buổi Acoustic sẽ mang đến cho bạn một cảm xúc riêng – đôi khi là bình yên, đôi khi là hứng khởi, nhưng chắc chắn là đáng nhớ.',
      },
    ],
  },
  'bai-viet-2': {
    id: '2',
    slug: 'bai-viet-2',
    title: 'Check-in Giáng sinh, rinh ngay voucher 100k tại Trend Coffee & Foods!',
    summary: 'Mùa lễ hội cuối năm đã chính thức gõ cửa, mang theo không khí lung linh và rộn ràng khắp mọi nẻo đường. Tại Trend Coffee & Foods, Giáng Sinh năm nay trở nên đặc biệt hơn bao giờ hết với chương trình "Check-in Giáng sinh – Rinh ngay voucher 100k" dành cho tất cả khách hàng.',
    thumbnail: NewsArticle21,
    publishDate: '2025-11-27',
    contentBlocks: [
      {
        type: 'paragraph',
        content: 'Mùa lễ hội cuối năm đã chính thức gõ cửa, mang theo không khí lung linh và rộn ràng khắp mọi nẻo đường. Tại Trend Coffee & Foods, Giáng Sinh năm nay trở nên đặc biệt hơn bao giờ hết với chương trình "Check-in Giáng sinh – Rinh ngay voucher 100k" dành cho tất cả khách hàng đến trải nghiệm và thưởng thức không gian ấm áp của quán.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle21,
      },
      {
        type: 'heading',
        content: 'Không khí Noel rực rỡ tại Trend Coffee',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Ngay từ đầu tháng 12, Trend Coffee đã khoác lên mình diện mạo Giáng Sinh với Cây thông lớn được trang trí theo phong cách rustic ấm áp. Góc background check-in độc lạ dành riêng cho mùa Noel. Ánh đèn vàng ấm, phụ kiện tuyết, vòng nguyệt quế phủ khắp không gian. Các món nước chủ đề Giáng Sinh "độc quyền mùa lễ".',
      },
      {
        type: 'paragraph',
        content: 'Chỉ cần bước vào là bạn đã cảm nhận được vibe Noel trọn vẹn – một nơi lý tưởng để chụp ảnh, hẹn hò và thư giãn.',
      },
      {
        type: 'heading',
        content: 'Cách tham gia để nhận ngay voucher 100.000đ',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Tham gia cực kỳ đơn giản, chỉ 3 bước là nhận liền tay voucher trị giá 100k dùng cho lần ghé tiếp theo:',
      },
      {
        type: 'heading',
        content: 'Check-in tại Trend Coffee & Foods',
        level: 3,
      },
      {
        type: 'paragraph',
        content: 'Chụp ảnh tại bất kỳ góc Giáng Sinh nào trong quán.',
      },
      {
        type: 'heading',
        content: 'Đăng lên Facebook hoặc Instagram cá nhân',
        level: 3,
      },
      {
        type: 'paragraph',
        content: '• Chế độ công khai\n• Gắn thẻ Trend Coffee & Foods\n• Thêm hashtag: #TrendCoffee #Noel',
      },
      {
        type: 'image',
        imageUrl: NewsArticle22,
      },
      {
        type: 'heading',
        content: 'Xuất trình bài đăng cho nhân viên',
        level: 3,
      },
      {
        type: 'paragraph',
        content: 'Nhận ngay voucher 100k siêu hấp dẫn!',
      },
      {
        type: 'paragraph',
        content: '(Voucher áp dụng từ 22/12/2025 đến 31/12/2025, điều kiện chi tiết xem tại quán.)',
      },
      {
        type: 'heading',
        content: 'Trend Coffee – điểm hẹn mùa lễ hội',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Không chỉ check-in, đến Trend Coffee & Foods mùa này bạn còn được tận hưởng Menu Giáng Sinh với cacao nóng, matcha latte, cookie mùa đông, bánh ngọt siêu tươi mỗi ngày. Ngoài ra không gian ấm cúng phù hợp hẹn hò, gặp gỡ bạn bè, làm việc cuối năm, nhiều góc decor dành riêng cho khách thích chụp ảnh.',
      },
      {
        type: 'paragraph',
        content: 'Chúng tôi luôn mong muốn mang đến trải nghiệm trọn vẹn nhất – từ ly cà phê đến từng khoảnh khắc bạn dành ở Trend.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle23,
      },
      {
        type: 'heading',
        content: 'Lên đồ thật xinh và ghé Trend Coffee ngay hôm nay!',
        level: 2,
      },
      {
        type: 'heading',
        content: 'Check-in Giáng sinh – Rinh voucher 100k',
        level: 3,
      },
      {
        type: 'paragraph',
        content: '• Thời gian diễn ra chương trình: 22/12/2025 - 31/12/2025\n• Thời gian áp dụng voucher: 22/12/2025 - 31/12/2025\n• Địa chỉ: Trend Coffee & Foods – 03 Nguyễn Công Trứ, Bình Thọ, Thủ Đức.',
      },
      {
        type: 'paragraph',
        content: 'Chỉ diễn ra trong mùa Giáng Sinh, vì vậy nhớ sắp xếp thời gian ghé Trend Coffee để vừa thưởng thức đồ uống ngon, vừa nhận ưu đãi siêu hời.',
      },
    ],
  },
  'bai-viet-3': {
    id: '3',
    slug: 'bai-viet-3',
    title: 'Trend Coffee ưu đãi đồng giá 29.000đ trong tuần khai trương',
    summary: 'Tuần khai trương luôn là dấu mốc quan trọng đối với Trend Coffee, nơi chúng tôi chính thức mở cửa và mang đến cho khách hàng những trải nghiệm đồ uống chất lượng trong không gian rustic hiện đại. Để chào đón giai đoạn đặc biệt này, Trend Coffee triển khai chương trình ưu đãi đồng giá 29.000đ cho toàn bộ menu nước trong suốt tuần lễ khai trương.',
    thumbnail: NewsArticle31,
    publishDate: '2025-11-27',
    contentBlocks: [
      {
        type: 'paragraph',
        content: 'Tuần khai trương luôn là dấu mốc quan trọng đối với Trend Coffee, nơi chúng tôi chính thức mở cửa và mang đến cho khách hàng những trải nghiệm đồ uống chất lượng trong không gian rustic hiện đại. Để chào đón giai đoạn đặc biệt này, Trend Coffee triển khai chương trình ưu đãi đồng giá 29.000đ cho toàn bộ menu nước trong suốt tuần lễ khai trương tại cơ sở Thủ Đức. Đây là cơ hội để khách hàng thưởng thức trọn vẹn hương vị cà phê, trà và đá xay với mức giá hấp dẫn nhất trong năm.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle31,
      },
      {
        type: 'heading',
        content: 'Ưu đãi đồng giá 29k cho toàn menu Trend Coffee',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Trong tuần khai trương, toàn bộ menu nước của Trend Coffee được áp dụng mức giá 29.000đ. Chương trình không giới hạn số lượng, không giới hạn khung giờ và áp dụng cho mọi nhóm khách. Tất cả sản phẩm được pha chế bởi đội ngũ barista chuyên nghiệp, sử dụng nguyên liệu được chọn lọc nhằm đảm bảo chất lượng tốt nhất.',
      },
      {
        type: 'paragraph',
        content: 'Chương trình đồng giá 29k bao gồm tất cả các dòng sản phẩm nổi bật như cà phê pha máy, trà trái cây tươi, đá xay, cold brew,... Đây là dịp lý tưởng để khách hàng trải nghiệm nhiều hương vị khác nhau trong một mức giá duy nhất.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle32,
      },
      {
        type: 'heading',
        content: 'Trải nghiệm không gian rustic hiện đại tại Trend Coffee',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Không chỉ mang đến những món uống chất lượng, Trend Coffee còn sở hữu không gian được thiết kế theo phong cách rustic hiện đại. Tone gỗ tự nhiên, ánh sáng ấm và sự kết hợp của cây xanh tạo nên không khí thư giãn, phù hợp để học tập, làm việc hoặc gặp gỡ bạn bè.',
      },
      {
        type: 'paragraph',
        content: 'Không gian được chia thành khu trong nhà và khu ngoài trời, đáp ứng nhu cầu đa dạng của khách. Dù bạn muốn tìm nơi yên tĩnh để làm việc hay một góc thoáng đãng để trò chuyện, Trend Coffee đều có lựa chọn phù hợp.',
      },
      {
        type: 'heading',
        content: 'Thời gian và địa điểm áp dụng chương trình',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Chương trình đồng giá 29k được áp dụng từ ngày 15/12/2025-21/12/2025 tại Trend Coffee & Foods, địa chỉ 03 Nguyễn Công Trứ, phường Bình Thọ, TP. Thủ Đức. Tất cả khách hàng đến trong thời gian này đều có thể sử dụng ưu đãi.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle33,
      },
      {
        type: 'heading',
        content: 'Vì sao Trend Coffee triển khai ưu đãi đồng giá 29k',
        level: 2,
      },
      {
        type: 'paragraph',
        content: 'Mục tiêu của chương trình là mang đến cơ hội để khách hàng trải nghiệm trọn vẹn hương vị và dịch vụ của Trend Coffee ngay từ những ngày đầu tiên. Đây cũng là cách để Trend Coffee gửi lời tri ân đến cộng đồng địa phương đã đồng hành trong suốt thời gian chuẩn bị trước khai trương.',
      },
      {
        type: 'paragraph',
        content: 'Chúng tôi muốn khách hàng cảm nhận được sự tận tâm trong từng sản phẩm và sự chỉn chu trong không gian, từ đó lan tỏa hình ảnh thương hiệu cà phê địa phương chất lượng và thân thiện.',
      },
      {
        type: 'image',
        imageUrl: NewsArticle34,
      },
      {
        type: 'paragraph',
        content: 'Tuần lễ khai trương với ưu đãi đồng giá 29k là thời điểm tuyệt vời để khách hàng ghé thăm Trend Coffee, thưởng thức menu đa dạng và trải nghiệm không gian mới tại Thủ Đức. Đây là chương trình chỉ diễn ra một lần duy nhất, mang đến mức giá tốt nhất trong năm cho toàn bộ menu nước.',
      },
      {
        type: 'paragraph',
        content: 'Hãy đến Trend Coffee trong tuần đầu khai trương để tận hưởng hương vị cà phê chất lượng và không gian thân thiện, ấm áp.',
      },
    ],
  },
}

export default function NewsArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const article = slug ? mockNewsArticles[slug] : null

  if (!article) {
    return (
      <div className="container py-6 flex flex-col gap-4 items-center">
        <h1 className="text-2xl font-bold">Không tìm thấy bài viết</h1>
        <Button onClick={() => navigate(ROUTE.CLIENT_NEWS)}>
          Quay lại trang tin tức
        </Button>
      </div>
    )
  }

  return (
    <div className="container py-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => navigate(ROUTE.CLIENT_NEWS)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{article.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ngày đăng: {new Date(article.publishDate).toLocaleDateString('vi-VN')}
          </p>
        </header>

        <div className="flex flex-col gap-6">
          {article.contentBlocks.map((block, index) => {
            if (block.type === 'heading') {
              const HeadingTag = `h${block.level || 2}` as keyof JSX.IntrinsicElements
              return (
                <HeadingTag
                  key={index}
                  className={`font-bold text-gray-900 dark:text-gray-100 ${
                    block.level === 2
                      ? 'text-xl sm:text-2xl mt-6 mb-2'
                      : block.level === 3
                      ? 'text-lg sm:text-xl mt-4 mb-2'
                      : 'text-base sm:text-lg mt-3 mb-1'
                  }`}
                >
                  {block.content}
                </HeadingTag>
              )
            }

            if (block.type === 'image' && block.imageUrl) {
              return (
                <div key={index} className="w-full rounded-lg overflow-hidden">
                  <img
                    src={block.imageUrl}
                    alt={`${article.title} - Ảnh ${index + 1}`}
                    className="w-full h-auto object-cover rounded-lg"
                  />
                </div>
              )
            }

            if (block.type === 'paragraph' && block.content) {
              // Check if content contains bullet points or line breaks
              const hasBulletPoints = block.content.includes('•') || block.content.includes('\n')
              return (
                <p
                  key={index}
                  className={`text-base sm:text-lg leading-relaxed text-gray-700 dark:text-gray-300 ${
                    hasBulletPoints ? 'whitespace-pre-line' : ''
                  }`}
                >
                  {block.content}
                </p>
              )
            }

            return null
          })}
        </div>
      </article>
    </div>
  )
}

