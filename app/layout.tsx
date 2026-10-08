import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://heumul-house.workspace-488055.chatgpt.site'),
  title: '흐물의 집',
  description: '흩어진 반죽을 합쳐 유령 가족을 집으로 돌려보내는 몽환적인 머지 게임',
  openGraph: {
    title: '흐물의 집',
    description: '흩어진 반죽을 합쳐 유령 가족을 집으로 돌려보내는 몽환적인 머지 게임',
    images: [{ url: '/og-v2.png', width: 1672, height: 941, alt: '흐물의 집 유령 가족' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '흐물의 집',
    description: '흩어진 반죽을 합쳐 유령 가족을 집으로 돌려보내는 몽환적인 머지 게임',
    images: ['/og-v2.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
