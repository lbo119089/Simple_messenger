"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ShieldCheck, Sparkles, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth success
    router.push("/chat");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent opacity-10 rounded-full blur-[100px]" />
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
              <MessageSquare className="h-10 w-10 text-accent" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">바이브챗</h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-medium mb-6 leading-tight">
            가장 편안하고 스마트한 실시간 메시징 경험
          </h2>
          <div className="space-y-6 text-primary-foreground/80">
            <div className="flex items-start gap-4">
              <ShieldCheck className="h-6 w-6 text-accent mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-white">안전한 1:1 대화</h3>
                <p>Supabase Auth 기반의 보안으로 오직 두 사람만의 비공개 대화.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Sparkles className="h-6 w-6 text-accent mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-white">AI 답장 제안</h3>
                <p>상황에 맞는 최적의 답장을 추천받아 더 빠르게 소통하세요.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Send className="h-6 w-6 text-accent mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-white">실시간 연결</h3>
                <p>지연 없는 실시간 메시지 전송으로 끊김 없는 대화를 즐기세요.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Section */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-2xl border-none">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-primary">
              {isLogin ? "환영합니다!" : "새로운 시작"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "계정에 로그인하여 대화를 이어가세요." : "바이브챗과 함께 새로운 대화를 시작하세요."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4 pt-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Input placeholder="사용자 이름" required className="h-12 border-muted" />
                </div>
              )}
              <div className="space-y-2">
                <Input type="email" placeholder="이메일 주소" required className="h-12 border-muted" />
              </div>
              <div className="space-y-2">
                <Input type="password" placeholder="비밀번호" required className="h-12 border-muted" />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90">
                {isLogin ? "로그인" : "회원가입"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="relative w-full text-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <span className="relative bg-background px-2 text-xs text-muted-foreground uppercase">
                또는
              </span>
            </div>
            <Button
              variant="link"
              className="text-primary hover:text-primary/80"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "아직 계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
