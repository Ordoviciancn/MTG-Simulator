import com.google.gson.*;
import forge.deck.Deck;
import forge.game.*;
import forge.game.card.*;
import forge.game.player.*;
import forge.game.zone.ZoneType;
import forge.gui.GuiBase;
import forge.gui.interfaces.*;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.player.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** One process owns one match. Only explicitly projected seat views leave the process. */
public final class ForgeHumanBridge {
    static final Gson JSON = new Gson();
    static final AtomicLong IDS = new AtomicLong();
    static final ExecutorService UI = Executors.newSingleThreadExecutor(r -> new Thread(r, "Bridge UI"));
    static final Seat[] SEATS = new Seat[2];
    static Game game;
    static Path resources;
    static volatile boolean initialized;
    static synchronized void emit(Object value) { System.out.println("FORGE_BRIDGE " + JSON.toJson(value)); System.out.flush(); }
    static Map<String,Object> obj(Object... pairs) { Map<String,Object> out = new LinkedHashMap<>(); for(int i=0;i<pairs.length;i+=2) out.put((String)pairs[i],pairs[i+1]); return out; }
    static void fail(Throwable e) { e.printStackTrace(System.err); emit(obj("type","error","fatal",true,"message",e.toString())); System.exit(1); }
    @SuppressWarnings("unchecked") static <T> T proxy(Class<T> type, InvocationHandler handler) { return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},handler); }
    static Object base(Method method,Object[] args) throws Exception {
        String name=method.getName();
        switch(name) {
            case "getAssetsDir": return resources.getParent().toString()+File.separator;
            case "isRunningOnDesktop": case "hasNetGame": return true;
            case "isGuiThread": return Thread.currentThread().getName().equals("Bridge UI");
            case "invokeInEdtLater": UI.execute((Runnable)args[0]); return null;
            case "invokeInEdtNow": case "invokeInEdtAndWait": if(Thread.currentThread().getName().equals("Bridge UI")) ((Runnable)args[0]).run(); else UI.submit((Runnable)args[0]).get(); return null;
            case "getCurrentVersion": return "ForgeHumanBridge";
            case "toString": return "Forge headless base";
        }
        if(method.getReturnType()==void.class) return null;
        if(method.getReturnType()==boolean.class) return false;
        throw new UnsupportedOperationException("Headless base callback: "+method);
    }
    static final class Seat implements InvocationHandler {
        final int index;
        final Player player;
        final PlayerControllerHuman controller;
        volatile String requestId;
        volatile CompletableFuture<JsonElement> pending;
        String message="";
        boolean okEnabled,cancelEnabled;
        String okLabel="OK",cancelLabel="Cancel";
        Seat(int index,Player player) { this.index=index;this.player=player;controller=(PlayerControllerHuman)player.getController(); }
        void input() {
            requestId=Long.toString(IDS.incrementAndGet());
            states();
            emit(obj("type","prompt","seat",index,"requestId",requestId,"kind","input","message",message,"okEnabled",okEnabled,"cancelEnabled",cancelEnabled,"okLabel",okLabel,"cancelLabel",cancelLabel));
        }
        JsonElement choose(String message,List<?> choices,int min,int max) throws Exception {
            CompletableFuture<JsonElement> future=new CompletableFuture<>(); pending=future;
            requestId=Long.toString(IDS.incrementAndGet());
            List<Object> options=new ArrayList<>();
            for(int i=0;i<choices.size();i++) options.add(obj("value",i,"label",String.valueOf(choices.get(i))));
            states();
            emit(obj("type","prompt","seat",index,"requestId",requestId,"kind","choice","message",message,"options",options,"min",min,"max",max));
            try { return future.get(); } finally { pending=null; }
        }
        List<?> chooseList(String message,List<?> choices,int min,int max) throws Exception {
            JsonElement answer=choose(message,choices,min,max);
            List<JsonElement> indices=new ArrayList<>();
            if(answer.isJsonArray()) answer.getAsJsonArray().forEach(indices::add); else indices.add(answer);
            Set<Integer> unique=new LinkedHashSet<>();
            for(JsonElement i:indices) { int value=i.getAsInt(); if(value<0||value>=choices.size()) throw new IllegalArgumentException("Choice out of range"); unique.add(value); }
            if(unique.size()<min||unique.size()>max) throw new IllegalArgumentException("Invalid selection count");
            List<Object> result=new ArrayList<>(); for(int i:unique) result.add(choices.get(i)); return result;
        }
        @Override public Object invoke(Object proxy,Method method,Object[] a) throws Throwable {
            String n=method.getName();
            if(method.isDefault()) return InvocationHandler.invokeDefault(proxy,method,a);
            switch(n) {
                case "toString": return "Bridge seat "+index;
                case "getGameView": return game.getView();
                case "isNetGame": return true;
                case "isLibgdxPort": case "isUiSetToSkipPhase": case "isGamePaused": case "isSelecting": return false;
                case "getGameSpeed": return forge.gui.control.PlaybackSpeed.NORMAL;
                case "getDayTime": return "";
                case "getGamestate": return null;
                case "showPromptMessage": message=String.valueOf(a[1]); input(); return null;
                case "updateButtons": okLabel=(String)a[1];cancelLabel=(String)a[2];okEnabled=(boolean)a[3];cancelEnabled=(boolean)a[4];input();return null;
                case "getAbilityToPlay": return chooseList("Choose ability",(List<?>)a[1],1,1).get(0);
                case "one": case "oneOrNone": { List<?> picked=chooseList((String)a[0],(List<?>)a[1],n.equals("one")?1:0,1); return picked.isEmpty()?null:picked.get(0); }
                case "getChoices": return chooseList((String)a[0],(List<?>)a[3],(int)a[1],(int)a[2]);
                case "many": return chooseList((String)a[0]+" "+a[1],(List<?>)a[4],(int)a[2],(int)a[3]);
                case "confirm": return chooseList((String)a[1],(List<?>)a[3],1,1).get(0).equals(((List<?>)a[3]).get(0));
                case "showConfirmDialog": return chooseList((String)a[0],List.of(a[2],a[3]),1,1).get(0).equals(a[2]);
                case "showOptionDialog": return choose((String)a[0],(List<?>)a[3],1,1).getAsInt();
                case "chooseSingleEntityForEffect": { List<?> picked=chooseList((String)a[0],(List<?>)a[1],(boolean)a[3]?0:1,1);return picked.isEmpty()?null:picked.get(0); }
                case "chooseEntitiesForEffect": return chooseList((String)a[0],(List<?>)a[1],(int)a[2],(int)a[3]);
                case "tempShowZones": return a[1];
                case "openZones": return new PlayerZoneUpdates();
                case "reveal": emit(obj("type","event","seat",index,"message",String.valueOf(a[0]),"items",((List<?>)a[1]).stream().map(String::valueOf).toList()));return null;
                case "message": emit(obj("type","event","seat",index,"message",String.valueOf(a[0])));return null;
                case "showErrorDialog": throw new IllegalStateException(String.valueOf(a[0]));
            }
            if(method.getReturnType()==void.class) return null;
            emit(obj("type","prompt","seat",index,"requestId",Long.toString(IDS.incrementAndGet()),"kind","unsupported","message","Unsupported Forge callback: "+n));
            throw new UnsupportedOperationException("Forge callback: "+method);
        }
    }
    static Map<String,Object> card(Card c,Player viewer) {
        Map<String,Object> out=obj("id",c.getId(),"ownerId",c.getOwner().getId(),"tapped",c.isTapped());
        if(!c.getView().canBeShownTo(viewer.getView()) || (c.isFaceDown() && !c.getView().mayPlayerLook(viewer.getView()))) { out.put("name","Face-down card");out.put("kind","spell");return out; }
        out.put("name",c.getName());out.put("kind",c.isLand()?"land":c.isCreature()?"creature":"spell");
        if(c.isCreature()){out.put("power",c.getNetPower());out.put("toughness",c.getNetToughness());} return out;
    }
    static List<Object> zone(Player owner,ZoneType zone,Player viewer) { List<Object> result=new ArrayList<>();for(Card c:owner.getCardsIn(zone)) result.add(card(c,viewer));return result; }
    static void states() {
        if(game==null)return;
        for(Seat seat:SEATS) {if(seat==null)continue; List<Object> players=new ArrayList<>();for(Player p:game.getPlayers())players.add(obj("id",p.getId(),"name",p.getName(),"life",p.getLife(),"libraryCount",p.getCardsIn(ZoneType.Library).size(),"handCount",p.getCardsIn(ZoneType.Hand).size(),"hand",p==seat.player?zone(p,ZoneType.Hand,seat.player):List.of(),"battlefield",zone(p,ZoneType.Battlefield,seat.player),"graveyard",zone(p,ZoneType.Graveyard,seat.player),"exile",zone(p,ZoneType.Exile,seat.player)));
            List<Object> stack=new ArrayList<>();for(Card c:game.getCardsIn(ZoneType.Stack))stack.add(card(c,seat.player));
            Player active=game.getPhaseHandler().getPlayerTurn();emit(obj("type","state","seat",seat.index,"players",players,"stack",stack,"phase",String.valueOf(game.getPhaseHandler().getPhase()),"activePlayerId",active==null?null:active.getId(),"gameOver",game.isGameOver())); }
    }
    static void init(JsonObject input) {
        try {
            List<RegisteredPlayer> players=new ArrayList<>();
            for(JsonElement entry:input.getAsJsonArray("players")) { JsonObject p=entry.getAsJsonObject();Deck deck=new Deck(p.get("name").getAsString());
                for(JsonElement line:p.getAsJsonArray("deck")){JsonObject row=line.getAsJsonObject();String name=row.get("name").getAsString();var paper=FModel.getMagicDb().getCommonCards().getCard(name);if(paper==null)throw new IllegalArgumentException("Unknown Forge card: "+name);deck.getMain().add(paper,row.get("count").getAsInt());}
                players.add(new RegisteredPlayer(deck).setPlayer(new LobbyPlayerHuman(p.get("name").getAsString()))); }
            if(players.size()!=2)throw new IllegalArgumentException("Exactly two players required");
            Match match=new Match(new GameRules(GameType.Constructed),players,"Tabletop Forge match");game=match.createGame();
            for(int i=0;i<2;i++){Seat seat=new Seat(i,game.getPlayers().get(i));SEATS[i]=seat;seat.controller.setGui(proxy(IGuiGame.class,seat));seat.controller.setYieldPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,"true");}
            match.startGame(game);states();emit(obj("type","event","message","Game finished"));
        } catch(Throwable e){fail(e);}
    }
    static void command(JsonObject input) {
        String type=input.get("type").getAsString();
        if(type.equals("init")){if(initialized)throw new IllegalStateException("Already initialized");initialized=true;new Thread(()->init(input),"Forge match").start();return;}
        int index=input.get("seat").getAsInt();if(index<0||index>1||SEATS[index]==null)throw new IllegalArgumentException("Invalid seat");Seat seat=SEATS[index];
        if(type.equals("control")){seat.controller.setYieldPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,Boolean.toString(!input.get("fullControl").getAsBoolean()));return;}
        if(!Objects.equals(seat.requestId,input.get("requestId").getAsString()))throw new IllegalArgumentException("Stale prompt");
        if(type.equals("choice")){if(seat.pending==null)throw new IllegalStateException("No modal choice");seat.pending.complete(input.get("value"));return;}
        UI.execute(()->{try{var inputProxy=seat.controller.getInputProxy();switch(type){case "ok":if(!seat.okEnabled)throw new IllegalStateException("OK disabled");inputProxy.selectButtonOK();break;case "cancel":if(!seat.cancelEnabled)throw new IllegalStateException("Cancel disabled");inputProxy.selectButtonCancel();break;case "selectCard":{int id=input.get("cardId").getAsInt();Card found=null;for(Card c:game.getCardsInGame())if(c.getId()==id)found=c;if(found==null||!found.getView().canBeShownTo(seat.player.getView()))throw new IllegalArgumentException("Card unavailable");inputProxy.selectCard(found.getView(),null,null);break;}case "selectPlayer":{int id=input.get("playerId").getAsInt();Player found=null;for(Player p:game.getPlayers())if(p.getId()==id)found=p;if(found==null)throw new IllegalArgumentException("Player unavailable");inputProxy.selectPlayer(found.getView(),null);break;}default:throw new IllegalArgumentException("Unknown command");}states();}catch(Throwable e){emit(obj("type","error","seat",index,"fatal",false,"message",e.toString()));}});
    }
    public static void main(String[] args) throws Exception {
        resources=Path.of(args[0]).toAbsolutePath();Path session=Path.of(args[1]).toAbsolutePath();Files.createDirectories(session);
        GuiBase.setInterface(proxy(IGuiBase.class,(p,m,a)->base(m,a)));
        Thread.setDefaultUncaughtExceptionHandler((t,e)->fail(e));
        FModel.initialize(proxy(IProgressBar.class,(p,m,a)->m.getReturnType()==boolean.class?false:null),prefs->{prefs.setPref(FPref.LOAD_CARD_SCRIPTS_LAZILY,true);return null;});
        emit(obj("type","ready","engine","forge","protocol",1));
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(System.in,java.nio.charset.StandardCharsets.UTF_8))){String line;while((line=reader.readLine())!=null){try{command(JsonParser.parseString(line).getAsJsonObject());}catch(Throwable e){emit(obj("type","error","fatal",false,"message",e.toString()));}}}
        System.exit(0);
    }
}
