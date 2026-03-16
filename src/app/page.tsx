"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ShieldCheck, Sparkles, Send, AlertCircle, User, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(PlaceHolderImages[0].imageUrl);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/chat");
    }
  }, [user, isLoading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth || !db) {
      toast({
        variant: "destructive",
        title: "연결 오류",
        description: "Firebase 설정이 필요합니다.",
      });
      return;
    }
    
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        await updateProfile(newUser, {
          displayName: username,
          photoURL: selectedAvatar
        });

        await setDoc(doc(db, "users", newUser.uid), {
          username: username,
          avatarUrl: selectedAvatar,
          id: newUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      router.push("/chat");
    } catch (error: any) {
      console.error("Auth error:", error);
      let message = "인증에 실패했습니다.";
      if (error.code === "auth/email-already-in-use") message = "이미 사용 중인 이메일입니다.";
      else if (error.code === "auth/weak-password") message = "비밀번호는 6자리 이상이어야 합니다.";
      else if (error.code === "auth/invalid-credential") message = "정보가 일치하지 않습니다.";

      toast({
        variant: "destructive",
        title: "오류 발생",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
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
            나만의 아바타로 스마트한 대화를 시작하세요
          </h2>
          <div className="space-y-6 text-primary-foreground/80">
            <div className="flex items-start gap-4">
              <Sparkles className="h-6 w-6 text-accent mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-white">커스텀 프로필 설정</h3>
                <p>회원가입 시 원하는 아바타를 선택하고 언제든 변경할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <Card className="shadow-2xl border-none">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold text-primary">
                {isLogin ? "환영합니다!" : "프로필 설정"}
              </CardTitle>
              <CardDescription>
                {isLogin ? "계정에 로그인하여 대화를 이어가세요." : "사용할 이름과 아바타를 선택해주세요."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4 pt-4">
                {!isLogin && (
                  <>
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-muted-foreground">아바타 선택</label>
                      <div className="flex justify-center gap-4 py-2">
                        {PlaceHolderImages.map((img) => (
                          <div 
                            key={img.id}
                            className="relative cursor-pointer group"
                            onClick={() => setSelectedAvatar(img.imageUrl)}
                          >
                            <Avatar className={cn(
                              "h-16 w-16 border-4 transition-all duration-200",
                              selectedAvatar === img.imageUrl ? "border-primary scale-110 shadow-lg" : "border-transparent opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0"
                            )}>
                              <AvatarImage src={img.imageUrl} />
                              <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                            {selectedAvatar === img.imageUrl && (
                              <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1 border-2 border-white shadow-sm">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Input 
                        placeholder="사용자 이름" 
                        required 
                        className="h-12 border-muted" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Input 
                    type="email" 
                    placeholder="이메일 주소" 
                    required 
                    className="h-12 border-muted" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Input 
                    type="password" 
                    placeholder="비밀번호" 
                    required 
                    className="h-12 border-muted" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90">
                  {loading ? "처리 중..." : (isLogin ? "로그인" : "회원가입 및 시작")}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                variant="link"
                className="text-primary"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "아직 계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
