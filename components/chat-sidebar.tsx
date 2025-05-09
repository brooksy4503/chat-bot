"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MessageSquare, PlusCircle, Trash2, ServerIcon, Settings, Sparkles, ChevronsUpDown, Copy, Github, Key, LogOut, Globe } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuBadge,
    useSidebar
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import { MCPServerManager } from "./mcp-server-manager";
import { ApiKeyManager } from "./api-key-manager";
import { ThemeToggle } from "./theme-toggle";
import { getUserId, updateUserId } from "@/lib/user-id";
import { useChats } from "@/lib/hooks/use-chats";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMCP } from "@/lib/context/mcp-context";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInButton } from "@/components/auth/SignInButton";
import { useSession, signOut } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Sun } from "lucide-react";
import { useWebSearch } from "@/lib/context/web-search-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatList } from "./chat-list";

const LOCAL_USER_ID_KEY = 'ai-chat-user-id';

export function ChatSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [userId, setUserId] = useState<string | null>(null);
    const [mcpSettingsOpen, setMcpSettingsOpen] = useState(false);
    const [apiKeySettingsOpen, setApiKeySettingsOpen] = useState(false);
    const { state, setOpen, openMobile, setOpenMobile } = useSidebar();
    const isCollapsed = state === "collapsed";
    const [editUserIdOpen, setEditUserIdOpen] = useState(false);
    const [newUserId, setNewUserId] = useState('');

    const { data: session, isPending: isSessionLoading } = useSession();
    const authenticatedUserId = session?.user?.id;
    const previousSessionRef = useRef(session);

    const queryClient = useQueryClient();

    const { mcpServers, setMcpServers, selectedMcpServers, setSelectedMcpServers } = useMCP();
    const { webSearchContextSize, setWebSearchContextSize, webSearchEnabled } = useWebSearch();
    const isAnyOpenRouterModelSelected = true;

    const renderChatSkeletons = () => {
        return Array(3).fill(0).map((_, index) => (
            <SidebarMenuItem key={`skeleton-${index}`} className="px-0">
                <div className={cn(
                    "flex items-center gap-2 px-3 py-2 w-full",
                    isCollapsed ? "justify-center" : "pr-10"
                )}>
                    <Skeleton className="h-4 w-4 rounded-md flex-shrink-0" />
                    {!isCollapsed && (
                        <>
                            <Skeleton className="h-4 flex-grow max-w-[160px]" />
                            <div className="ml-auto flex items-center gap-1">
                                <Skeleton className="h-4 w-4 rounded-md" />
                                <Skeleton className="h-4 w-4 rounded-md" />
                            </div>
                        </>
                    )}
                </div>
            </SidebarMenuItem>
        ));
    };

    useEffect(() => {
        if (!isSessionLoading) {
            if (authenticatedUserId) {
                setUserId(authenticatedUserId);
            } else {
                setUserId(getUserId());
            }
        }
    }, [authenticatedUserId, isSessionLoading]);

    useEffect(() => {
        const currentSession = session;
        const previousSession = previousSessionRef.current;

        if (!previousSession?.user && currentSession?.user?.id) {
            const authenticatedUserId = currentSession.user.id;
            console.log('User logged in:', authenticatedUserId);
            
            const localUserId = localStorage.getItem(LOCAL_USER_ID_KEY);

            if (localUserId && localUserId !== authenticatedUserId) {
                console.log(`Found local user ID ${localUserId}, attempting migration...`);
                
                fetch('/api/chats/migrate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ localUserId }),
                })
                .then(async (res) => {
                    if (res.ok) {
                        const data = await res.json();
                        console.log(`Migration successful: Migrated ${data.migratedCount} chats.`);
                        localStorage.removeItem(LOCAL_USER_ID_KEY);
                    } else {
                        console.error('Chat migration failed:', res.status, await res.text());
                        toast.error("Failed to migrate local chats.");
                    }
                })
                .catch((error) => {
                    console.error('Error calling migration API:', error);
                    toast.error("Error migrating local chats.");
                })
                .finally(() => {
                    setUserId(authenticatedUserId);
                    queryClient.invalidateQueries({ queryKey: ['chats'] });
                    queryClient.invalidateQueries({ queryKey: ['chat'] }); 
                    console.log('Chat queries invalidated for new user ID.');
                });
            } else {
                setUserId(authenticatedUserId);
                queryClient.invalidateQueries({ queryKey: ['chats'] });
                queryClient.invalidateQueries({ queryKey: ['chat'] });
            }
        } else if (previousSession?.user && !currentSession?.user) {
            console.log('User logged out.');
            const localId = getUserId();
            setUserId(localId);
            router.push('/');
            queryClient.invalidateQueries({ queryKey: ['chats'] });
            queryClient.invalidateQueries({ queryKey: ['chat'] });
        }

        previousSessionRef.current = currentSession;
    }, [session, queryClient, router]);
    
    const { chats, isLoading: isChatsLoading, deleteChat, refreshChats, updateChatTitle, isUpdatingChatTitle } = useChats(userId ?? '');
    const isLoading = isSessionLoading || (userId === null) || isChatsLoading;

    const handleNewChat = () => {
        router.push('/');
        setOpenMobile(false);
    };

    const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        deleteChat(chatId);
        
        if (pathname === `/chat/${chatId}`) {
            router.push('/');
        }
    };

    const activeServersCount = selectedMcpServers.length;

    const handleUpdateUserId = () => {
        if (!newUserId.trim()) {
            toast.error("User ID cannot be empty");
            return;
        }
        if (authenticatedUserId) {
            toast.error("Cannot manually edit User ID while logged in.");
            setEditUserIdOpen(false);
            return;
        }

        updateUserId(newUserId.trim());
        setUserId(newUserId.trim());
        setEditUserIdOpen(false);
        toast.success("User ID updated successfully");
        
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        queryClient.invalidateQueries({ queryKey: ['chat'] });
    };

    if (isLoading) {
        return (
            <Sidebar className="shadow-sm bg-background/80 dark:bg-background/40 backdrop-blur-md" collapsible="icon">
                <SidebarHeader className="p-4 border-b border-border/40">
                    <div className="flex items-center justify-start">
                        <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center w-full" : ""}`}>
                            <div className={`flex items-center justify-center rounded-full bg-primary ${isCollapsed ? 'h-6 w-6 flex-shrink-0' : 'h-8 w-8'}`}>
                                <Image src="/logo.png" alt="ChatLima logo" width={32} height={32} className={`${isCollapsed ? 'h-4 w-4' : 'h-6 w-6'}`} />
                            </div>
                            {!isCollapsed && (
                                <div className="font-semibold text-lg text-foreground/90">ChatLima</div>
                            )}
                        </div>
                    </div>
                </SidebarHeader>
                
                <SidebarContent className="flex flex-col h-[calc(100vh-8rem)]">
                    <SidebarGroup className="flex-1 min-h-0">
                        <SidebarGroupLabel className={cn(
                            "px-4 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider",
                            isCollapsed ? "sr-only" : ""
                        )}>
                            Chats
                        </SidebarGroupLabel>
                        {!isCollapsed && (
                            <div className="px-3 pt-1 pb-2 border-b border-border/40">
                                <Skeleton className="h-9 w-full mb-2" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        )}
                        <SidebarGroupContent className={cn(
                            "overflow-y-auto pt-1",
                            isCollapsed ? "overflow-x-hidden overflow-y-hidden" : ""
                        )}>
                            <SidebarMenu>{renderChatSkeletons()}</SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    
                    <div className="relative my-0">
                        <div className="absolute inset-x-0">
                            <Separator className="w-full h-px bg-border/40" />
                        </div>
                    </div>
                    
                    <SidebarGroup className="flex-shrink-0">
                        <SidebarGroupLabel className={cn(
                            "px-4 pt-0 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider",
                            isCollapsed ? "sr-only" : ""
                        )}>
                            MCP Servers
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton 
                                        onClick={() => setMcpSettingsOpen(true)}
                                        className={cn(
                                            "w-full flex items-center gap-2 transition-all"
                                        )}
                                        tooltip={isCollapsed ? "MCP Servers" : undefined}
                                    >
                                        <ServerIcon className={cn(
                                            "h-4 w-4 flex-shrink-0",
                                            activeServersCount > 0 ? "text-primary" : "text-muted-foreground"
                                        )} />
                                        {!isCollapsed && (
                                            <span className="flex-grow text-sm text-foreground/80">MCP Servers</span>
                                        )}
                                        {activeServersCount > 0 && !isCollapsed ? (
                                            <Badge 
                                                variant="secondary" 
                                                className="ml-auto text-[10px] px-1.5 py-0 h-5 bg-secondary/80"
                                            >
                                                {activeServersCount}
                                            </Badge>
                                        ) : activeServersCount > 0 && isCollapsed ? (
                                            <SidebarMenuBadge className="bg-secondary/80 text-secondary-foreground">
                                                {activeServersCount}
                                            </SidebarMenuBadge>
                                        ) : null}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                
                <SidebarFooter className="flex flex-col gap-2 p-3 border-t border-border/40">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </SidebarFooter>
            </Sidebar>
        );
    }

    const displayUserId = userId ?? '...';
    const isUserAuthenticated = !!authenticatedUserId;

    return (
        <>
            <Sidebar className="shadow-sm bg-background/80 dark:bg-background/40 backdrop-blur-md" collapsible="icon">
                <SidebarHeader className="p-4 border-b border-border/40">
                    <div className="flex items-center justify-start">
                        <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center w-full" : ""}`}>
                            <div className={`flex items-center justify-center rounded-full bg-primary ${isCollapsed ? 'h-6 w-6 flex-shrink-0' : 'h-8 w-8'}`}>
                                <Image src="/logo.png" alt="ChatLima logo" width={32} height={32} className={`${isCollapsed ? 'h-4 w-4' : 'h-6 w-6'}`} />
                            </div>
                            {!isCollapsed && (
                                <div className="font-semibold text-lg text-foreground/90">ChatLima</div>
                            )}
                        </div>
                    </div>
                </SidebarHeader>
                
                <SidebarContent className="flex flex-col h-[calc(100vh-8rem)]">
                    <SidebarGroup className="flex-1 min-h-0">
                        <SidebarGroupLabel className={cn(
                            "px-4 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider",
                            isCollapsed ? "sr-only" : ""
                        )}>
                            Chats
                        </SidebarGroupLabel>
                        <ChatList
                            chats={chats ?? []}
                            isLoading={isChatsLoading} 
                            isCollapsed={isCollapsed}
                            isUpdatingChatTitle={isUpdatingChatTitle}
                            onNewChat={handleNewChat}
                            onDeleteChat={handleDeleteChat}
                            onUpdateChatTitle={updateChatTitle}
                        />
                    </SidebarGroup>
                    
                    <div className="relative my-0">
                        <div className="absolute inset-x-0">
                            <Separator className="w-full h-px bg-border/40" />
                        </div>
                    </div>
                    
                    <SidebarGroup className="flex-shrink-0">
                        <SidebarGroupLabel className={cn(
                            "px-4 pt-0 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider",
                            isCollapsed ? "sr-only" : ""
                        )}>
                            MCP Servers
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton 
                                        onClick={() => setMcpSettingsOpen(true)}
                                        className={cn(
                                            "w-full flex items-center gap-2 transition-all"
                                        )}
                                        tooltip={isCollapsed ? "MCP Servers" : undefined}
                                    >
                                        <ServerIcon className={cn(
                                            "h-4 w-4 flex-shrink-0",
                                            activeServersCount > 0 ? "text-primary" : "text-muted-foreground"
                                        )} />
                                        {!isCollapsed && (
                                            <span className="flex-grow text-sm text-foreground/80">MCP Servers</span>
                                        )}
                                        {activeServersCount > 0 && !isCollapsed ? (
                                            <Badge 
                                                variant="secondary" 
                                                className="ml-auto text-[10px] px-1.5 py-0 h-5 bg-secondary/80"
                                            >
                                                {activeServersCount}
                                            </Badge>
                                        ) : activeServersCount > 0 && isCollapsed ? (
                                            <SidebarMenuBadge className="bg-secondary/80 text-secondary-foreground">
                                                {activeServersCount}
                                            </SidebarMenuBadge>
                                        ) : null}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    <div className="relative my-0">
                        <div className="absolute inset-x-0">
                            <Separator className="w-full h-px bg-border/40" />
                        </div>
                    </div>

                    <SidebarGroup className="flex-shrink-0">
                        <SidebarGroupLabel className={cn(
                            "px-4 pt-2 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider",
                            isCollapsed ? "sr-only" : ""
                        )}>
                            Settings
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                           <SidebarMenu>
                                <SidebarMenuItem>
                                    <ThemeToggle
                                        className="h-4 w-4 p-0"
                                        trigger={(
                                            <SidebarMenuButton 
                                                className={cn(
                                                    "w-full flex items-center gap-2 transition-all",
                                                    isCollapsed ? "justify-center" : ""
                                                )}
                                                tooltip={isCollapsed ? "Theme" : undefined}
                                            >
                                                <Flame className="h-4 w-4 rotate-0 scale-100 transition-all dark:scale-0 dark:-rotate-90 flex-shrink-0" />
                                                <Sun className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 light:rotate-0 light:scale-100 flex-shrink-0" />
                                                {!isCollapsed && <span className="text-sm text-foreground/80 flex-grow text-left">Theme</span>}
                                            </SidebarMenuButton>
                                        )}
                                    />
                                </SidebarMenuItem>
                                {webSearchEnabled && (
                                    <SidebarMenuItem>
                                        <DropdownMenu>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <DropdownMenuTrigger asChild>
                                                        <TooltipTrigger asChild>
                                                            <SidebarMenuButton
                                                                className={cn(
                                                                    "w-full flex items-center gap-2 transition-all",
                                                                    "hover:bg-secondary/50 active:bg-secondary/70",
                                                                    isCollapsed ? "justify-center" : ""
                                                                )}
                                                            >
                                                                <Globe className={cn(
                                                                    "h-4 w-4 flex-shrink-0",
                                                                    webSearchEnabled ? "text-primary" : "text-muted-foreground"
                                                                )} />
                                                                {!isCollapsed && (
                                                                    <span className="text-sm text-foreground/80 flex-grow text-left">
                                                                        Search Context ({webSearchContextSize.charAt(0).toUpperCase() + webSearchContextSize.slice(1)}) 
                                                                    </span>
                                                                )}
                                                            </SidebarMenuButton>
                                                        </TooltipTrigger>
                                                    </DropdownMenuTrigger>
                                                    {isCollapsed && (
                                                        <TooltipContent side="right" sideOffset={5}>
                                                            Web Search Context: {webSearchContextSize.charAt(0).toUpperCase() + webSearchContextSize.slice(1)}
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </TooltipProvider>
                                            <DropdownMenuContent 
                                                align="end" 
                                                side={isCollapsed ? "right" : "bottom"} 
                                                sideOffset={8} 
                                                className="min-w-[120px]"
                                            >
                                                <DropdownMenuLabel>Search Context Size</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={() => setWebSearchContextSize('low')}
                                                    className={cn(webSearchContextSize === 'low' && "bg-secondary")}
                                                >
                                                    Low
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => setWebSearchContextSize('medium')}
                                                    className={cn(webSearchContextSize === 'medium' && "bg-secondary")}
                                                >
                                                    Medium
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => setWebSearchContextSize('high')}
                                                    className={cn(webSearchContextSize === 'high' && "bg-secondary")}
                                                >
                                                    High
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </SidebarMenuItem>
                                )}
                           </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                
                <SidebarFooter className="flex flex-col gap-2 p-3 border-t border-border/40">
                    <SidebarMenu>
                        {/* Item removed */}
                    </SidebarMenu>
                    
                    <div className="relative my-0 pt-2">
                        <div className="absolute inset-x-0">
                            <Separator className="w-full h-px bg-border/40" />
                        </div>
                    </div>

                    {isSessionLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 mt-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            {!isCollapsed && <Skeleton className="h-4 w-24" />}
                        </div>
                    ) : session?.user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    className={cn(
                                        "flex items-center justify-start gap-2 px-3 py-2 mt-2 w-full h-auto focus-visible:ring-0",
                                        isCollapsed && "justify-center" 
                                    )}
                                >
                                    <Avatar className="h-8 w-8 rounded-full">
                                        <AvatarFallback>{session.user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {!isCollapsed && <span className="truncate">{session.user.name}</span>}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[calc(var(--sidebar-width)-1.5rem)] ml-3 mb-1">
                                <DropdownMenuLabel className="truncate">{session.user.name}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={async () => {
                                    try {
                                        await signOut();
                                        localStorage.removeItem(LOCAL_USER_ID_KEY);
                                        toast.info("You have been logged out.");
                                        router.push('/');
                                        queryClient.invalidateQueries({ queryKey: ['chats'] });
                                        queryClient.invalidateQueries({ queryKey: ['chat'] });
                                    } catch (error) {
                                        console.error("Sign out error:", error);
                                        toast.error("Failed to sign out.");
                                    }
                                }} className="cursor-pointer">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className={cn(
                            "flex items-center mt-2", 
                            isCollapsed ? "justify-center px-1 py-2" : "px-3 py-2 gap-2" 
                        )}>
                            <SignInButton isCollapsed={isCollapsed} />
                        </div>
                    )}

                    <Link 
                        href="https://github.com/zaidmukaddam/scira-mcp-chat" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={cn(
                            "flex items-center text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors py-2 mt-2 w-full",
                            isCollapsed ? "justify-center" : "justify-start px-3 gap-2"
                        )}
                    >
                        <div className={cn("flex items-center justify-center", isCollapsed ? "w-8 h-8" : "w-6 h-6")}>
                            <Github className="h-4 w-4" />
                        </div>
                        {!isCollapsed && <span>Powered by Scira Chat</span>}
                    </Link>
                </SidebarFooter>
            </Sidebar>

            <MCPServerManager
                servers={mcpServers}
                onServersChange={setMcpServers}
                selectedServers={selectedMcpServers}
                onSelectedServersChange={setSelectedMcpServers}
                open={mcpSettingsOpen}
                onOpenChange={setMcpSettingsOpen}
            />

            <Dialog open={editUserIdOpen && !isUserAuthenticated} onOpenChange={(open) => {
                setEditUserIdOpen(open);
                if (open) {
                    setNewUserId(userId ?? '');
                }
            }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Edit User ID</DialogTitle>
                        <DialogDescription>
                            Update your user ID for chat synchronization. This will affect which chats are visible to you.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="userId">User ID</Label>
                            <Input
                                id="userId"
                                value={newUserId}
                                onChange={(e) => setNewUserId(e.target.value)}
                                placeholder="Enter your user ID"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditUserIdOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateUserId}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}