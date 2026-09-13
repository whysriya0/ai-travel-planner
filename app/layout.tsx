import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Roam — Travel, with a little wonder',description:'A thoughtful travel planner that turns destinations, preferences, routes, activities and pauses into a journey that feels like you.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

