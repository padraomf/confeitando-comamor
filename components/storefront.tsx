"use client";
import { categorySlug } from "@/lib/category-path";
import { paymentAllowed, type PaymentMethod } from "@/lib/payment-options";
import { useBag } from "./bag-provider";
import { requestId as newRequestId } from "@/lib/request-id";
import { useEffect, useState, lazy, Suspense } from "react";
import { flushSync } from "react-dom";
import {
  ShoppingBag,
  MapPin,
  Heart,
  Share2,
  MessageCircle,
  ArrowUpRight,
  Search,
  Plus,
  Minus,
  Clock3,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Check,
  CreditCard,
  Banknote,
  Diamond,
  Truck,
  Store,
  LoaderCircle,
  PackageCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Brand, Footer } from "./brand";
import { OrderPayment } from "./order-payment";
import { OrderWhatsApp } from "./order-whatsapp";
import { productPath } from "@/lib/product-sharing";
import { PrintOrder } from "./print-order";
const LazyAddressFields = lazy(() =>
  import("./address-fields").then((m) => ({ default: m.AddressFields })),
);
function formatPhone(value: string) {
  const v = value.replace(/\D/g, "");
  if (!v) return "";
  if (v.length <= 2) return `(${v}`;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
}
function AddressFields(props: React.ComponentProps<typeof LazyAddressFields>) {
  return (
    <Suspense fallback={<p>Carregando endereço…</p>}>
      <LazyAddressFields {...props} />
    </Suspense>
  );
}
import {
  initialProducts,
  categories,
  defaultSettings,
  emptyAddress,
  money,
  profileSchema,
  addressSchema,
  addressText,
  type Product,
  type Profile,
  type Address,
  type Order,
} from "@/lib/commerce";
import { businessStatus } from "@/lib/store-hours";
import { shareProduct } from "@/lib/share-product";
const LazyProductSocial = lazy(() =>
  import("./product-social").then((m) => ({ default: m.ProductSocial })),
);
function ProductSocial(props: React.ComponentProps<typeof LazyProductSocial>) {
  return (
    <Suspense fallback={<p>Carregando comentários…</p>}>
      <LazyProductSocial {...props} />
    </Suspense>
  );
}
import { api, errorMessage } from "@/lib/client";
type Cart = Record<string, number>;
type Quote = {
  id: string;
  fee: number;
  distance: number;
  expires: number;
  address: Address;
};
export default function Storefront({
  initialProduct,
  initialCatalog,
  initialCategory,
}: {
  initialCategory?: string;
  initialProduct?: Product;
  initialCatalog?: {
    products: Product[];
    settings: typeof defaultSettings;
    categories: string[];
  };
}) {
  const [products, setProducts] = useState<Product[]>(
      initialCatalog?.products || (initialProduct ? [initialProduct] : []),
    ),
    [config, setConfig] = useState(initialCatalog?.settings || defaultSettings),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(""),
    [demo, setDemo] = useState(true),
    [online, setOnline] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>(
      initialCatalog
        ? ["Todos os doces", ...initialCatalog.categories]
        : categories,
    ),
    [clock, setClock] = useState(new Date()),
    [category, setCategory] = useState(initialCategory || "Todos os doces"),
    [search, setSearch] = useState(""),
    [step, setStep] = useState(0),
    [selected, setSelected] = useState<Product | null>(initialProduct || null),
    [selectedQty, setSelectedQty] = useState(1);
  const [profile, setProfile] = useState<Profile & { password?: string }>({
      name: "",
      cpf: "",
      email: "",
      phone: "",
      password: "",
      whatsappConsent: false,
    }),
    [customerExists, setCustomerExists] = useState(false),
    [address, setAddress] = useState<Address>(emptyAddress),
    [addressModal, setAddressModal] = useState(false),
    [quote, setQuote] = useState<Quote | null>(null),
    [delivery, setDelivery] = useState("delivery"),
    [payment, setPayment] = useState("cash"),
    [itemNotes, setItemNotes] = useState<Record<string, string>>({}),
    [note, setNote] = useState(""),
    [change, setChange] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState<Order | null>(null),
    [requestId, setRequestId] = useState("");
  async function load() {
    setLoadError("");
    try {
      const r = await api("catalog");
      setProducts(r.products);
      setAvailableCategories(["Todos os doces", ...r.categories]);
      const productId =
        new URLSearchParams(location.search).get("produto") ||
        initialProduct?.id;
      if (productId)
        setSelected(
          r.products.find((p: Product) => p.id === productId) || null,
        );
      setConfig(r.settings);
      setDemo(r.demo);
      setOnline(r.onlinePayment);
      setPayment(
        r.settings.cash
          ? "cash"
          : r.onlinePayment || r.settings.pixKey
            ? "pix"
            : "card_machine",
      );
      setSignedIn(r.signedIn);
      if (r.customerName) setProfile((p) => ({ ...p, name: r.customerName }));
      if (
        new URLSearchParams(location.search).has("checkout") &&
        !r.signedIn &&
        !r.guest
      )
        setStep(0);
      setDeliveryAvailable(r.deliveryAvailable);
      if (!r.deliveryAvailable && r.settings.pickup) setDelivery("pickup");
      if (r.signedIn || r.guest) {
        const p = await api("profile");
        if (p.profile) {
          setProfile(p.profile);
          if (p.profile.address) setAddress(p.profile.address);
        }
      }
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoaded(true);
    }
  }
  const {
    cart,
    setCart,
    cartReady,
    bag,
    setBag,
    setProducts: syncBagProducts,
  } = useBag();
  useEffect(() => {
    void load();
    if (
      new URLSearchParams(location.search).has("checkout") ||
      new URLSearchParams(location.search).has("sacola")
    ) {
      setBag(true);
      setStep(0);
    }
    return () => setBag(false);
  }, []);
  useEffect(() => {
    setRequestId(newRequestId());
  }, [cart, cartReady]);
  useEffect(() => {
    if (loaded) syncBagProducts(products);
  }, [products, loaded, syncBagProducts]);
  useEffect(() => {
    const open = (event: Event) => {
      event.preventDefault();
      setSelected(null);
      setAddressModal(false);
      setBag(true);
      setStep(0);
      setSuccess(null);
    };
    window.addEventListener("cca-open-bag", open);
    return () => window.removeEventListener("cca-open-bag", open);
  }, [setBag]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    const refresh = () => {
      if (document.visibilityState === "visible")
        api("catalog")
          .then((r) => {
            setConfig(r.settings);
            setOnline(r.onlinePayment);
            setAvailableCategories(["Todos os doces", ...r.categories]);
            setProducts(r.products);
          })
          .catch(() => {});
    };
    const sync = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      clearInterval(sync);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const status = businessStatus(config, clock);
  function selectProduct(p: Product) {
    setSelected(p);
    setSelectedQty(1);
    history.replaceState(null, "", productPath(p.id, p.name));
  }
  function updateSocial(p: Product) {
    setProducts((old) => old.map((x) => (x.id === p.id ? p : x)));
    setSelected((old) => (old?.id === p.id ? p : old));
  }
  const items = Object.entries(cart)
    .map(([id, quantity]) => ({
      product: products.find((p) => p.id === id),
      quantity,
    }))
    .filter((i): i is { product: Product; quantity: number } => !!i.product);
  const count = items.reduce((n, i) => n + i.quantity, 0),
    subtotal = items.reduce((n, i) => n + i.quantity * i.product.price, 0),
    fee = delivery === "pickup" ? 0 : (quote?.fee ?? 0),
    total = subtotal + fee;
  function adjust(id: string, delta: number) {
    setCart((old) => {
      const n = { ...old };
      n[id] = Math.max(
        0,
        Math.min(
          30,
          products.find((p) => p.id === id)?.stock ?? 30,
          (n[id] ?? 0) + delta,
        ),
      );
      if (!n[id]) delete n[id];
      return n;
    });
  }
  function add(id: string, quantity = 1) {
    if (
      products.find((p) => p.id === id)?.sold_out ||
      products.find((p) => p.id === id)?.stock === 0
    ) {
      toast.info("Este doce está esgotado.");
      return;
    }
    adjust(id, quantity);
    toast.success("Um carinho a mais na sua sacola.", {
      action: {
        label: "Ver sacola",
        onClick: () => {
          setBag(true);
          setStep(0);
        },
      },
    });
  }
  useEffect(() => {
    const mc = (document as any).modelContext;
    if (!mc?.registerTool) return;
    const ac = new AbortController();
    for (const tool of [
      {
        name: "read_bakery_catalog",
        description:
          "Read available bakery products and current cart without changing them.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          products: products.map(({ id, name, price, category, demo }) => ({
            id,
            name,
            priceInCents: price,
            category,
            demo: !!demo,
          })),
          cart,
        }),
      },
      {
        name: "add_products_to_bag",
        description:
          "Stage products in the bag; does not place or pay for an order.",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  quantity: { type: "integer", minimum: 1, maximum: 30 },
                },
                required: ["id", "quantity"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: any) => {
          if (
            !input ||
            !Array.isArray(input.items) ||
            !input.items.length ||
            input.items.some(
              (i: any) =>
                !products.some((p) => p.id === i.id) ||
                !Number.isInteger(i.quantity) ||
                i.quantity < 1 ||
                i.quantity > 30,
            )
          )
            throw new Error("Invalid products or quantities");
          let updated: Cart = {};
          flushSync(() => {
            setCart((old) => {
              const next = { ...old };
              for (const i of input.items)
                next[i.id] = Math.min(30, (next[i.id] ?? 0) + i.quantity);
              updated = next;
              return next;
            });
            setBag(true);
            setStep(0);
          });
          return { staged: true, cart: updated, placedOrder: false };
        },
      },
    ]) {
      try {
        Promise.resolve(mc.registerTool(tool, { signal: ac.signal })).catch(
          () => {},
        );
      } catch {}
    }
    return () => ac.abort();
  }, [products, cart]);
  const visible = products.filter(
    (p) =>
      (category === "Todos os doces" || p.category === category) &&
      (p.name + " " + p.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function updateAddress(a: Address) {
    setAddress(a);
    setQuote(null);
  }
  async function calculate() {
    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!parsed.data.location?.confirmed) {
      toast.error("Adicione e confirme o ponto de entrega no mapa.");
      return;
    }
    setBusy(true);
    try {
      if (!signedIn)
        await api("customer/guest", { method: "POST", body: "{}" });
      const r = await api("quote", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setQuote(r);
      toast.success("Frete calculado para seu endereço.");
    } catch (e) {
      setQuote(null);
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function continueBag() {
    if (!count || busy) return;
    if (!signedIn) {
      if (profile.phone.replace(/\D/g, "").length < 10) {
        toast.error("Informe um telefone com DDD válido.");
        return;
      }
      setBusy(true);
      try {
        const r = await api("customer/lookup-phone", {
          method: "POST",
          body: JSON.stringify({ phone: profile.phone }),
        });
        if (r.exists) {
          setCustomerExists(true);
          setProfile((p) => ({ ...p, name: r.name, email: r.email || "", cpf: r.cpf || "" }));
          if (r.address) {
            setAddress(r.address);
          }
          if (r.quote) {
            setQuote(r.quote);
            setAddress(r.quote.address);
          }
        } else {
          setCustomerExists(false);
        }
        setStep(1); // Go to Delivery
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep(1);
  }
  function continueDelivery() {
    if (delivery === "delivery" && (!quote || quote.expires < Date.now())) {
      toast.error("Calcule o frete para continuar.");
      return;
    }
    if (!signedIn) {
      setStep(2); // Go to Profile
      return;
    }
    setStep(3); // Go to Payment
  }
  async function saveProfile() {
    const r = profileSchema.omit({ address: true }).safeParse(profile);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    setProfile(r.data);
    
    if (!customerExists) {
      setBusy(true);
      try {
        if (profile.password && profile.password.length >= 6) {
          await api("customer/register", {
            method: "POST",
            body: JSON.stringify({ ...profile, address: delivery === "delivery" ? address : undefined, email: profile.email || profile.phone })
          });
          setSignedIn(true);
        }
      } catch (e) {
        toast.error(errorMessage(e));
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }
    
    setStep(3);
  }
  async function placeOrder() {
    if (busy) return;
    const valid = profileSchema.safeParse(profile);
    if (!valid.success) {
      toast.error(valid.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const r = await api("orders", {
        method: "POST",
        body: JSON.stringify({
          guest: !signedIn,
          requestId,
          expectedTotal: total,
          items: items.map((i) => ({
            id: i.product.id,
            quantity: i.quantity,
            note: itemNotes[i.product.id] || "",
          })),
          profile: {
            ...profile,
            ...(delivery === "delivery" ? { address } : { address: undefined }),
          },
          delivery,
          quoteId: delivery === "delivery" ? quote?.id : undefined,
          payment,
          note,
          change:
            payment === "cash" && change
              ? Math.round(Number(change.replace(",", ".")) * 100)
              : null,
        }),
      });
      setSuccess(r.order);
      setCart({});
      if (r.order.checkout_url) {
        window.location.href = r.order.checkout_url;
      } else if (r.paymentError) {
        toast.info(
          "Pedido salvo. Você pode tentar o pagamento em Meus pedidos.",
        );
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const openBag = () => {
    setBag(true);
    setStep(0);
    setSuccess(null);
  };
  const prepaid = delivery === "pickup" && config.pickupPrepaid;
  useEffect(() => {
    if (!paymentAllowed(config, delivery, payment as PaymentMethod, online)) {
      const next = (["pix", "card", "cash", "card_machine"] as const).find(
        (p) => paymentAllowed(config, delivery, p, online),
      );
      if (next) setPayment(next);
    }
  }, [config, delivery, payment, online]);
  const deliveryOptions = (
    <RadioGroup
      value={delivery}
      onValueChange={(v) => setDelivery(v)}
      className="delivery-options"
    >
      <label className={delivery === "delivery" ? "choice active" : "choice"}>
        <RadioGroupItem
          value="delivery"
          id="delivery-option"
          disabled={!deliveryAvailable}
        />
        <Truck size={20} />
        <span>
          Receber em casa
          <small>
            {deliveryAvailable ? "Entrega até você" : "Entrega em configuração"}
          </small>
        </span>
      </label>
      <label className={delivery === "pickup" ? "choice active" : "choice"}>
        <RadioGroupItem
          value="pickup"
          id="pickup-option"
          disabled={!config.pickup}
        />
        <Store size={20} />
        <span>
          Retirada na Confeitaria<small>Sem taxa de entrega</small>
        </span>
      </label>
    </RadioGroup>
  );
  return (
    <>
      <header className="store-header compact-header">
        <Brand />
        <nav>
          <a className="active" href="/catalogo">
            Catálogo
          </a>
          <a href="/encomendas">Encomendas</a>
          <a href="/conta">Área do cliente</a>
          <a href="/pedidos">Meus pedidos</a>
        </nav>
        <button className="bag-button" onClick={openBag}>
          <ShoppingBag size={18} />
          <span>Sacola</span>
          <b>{count}</b>
        </button>
      </header>
      <nav className="mobile-store-nav">
        <a href="/catalogo">Catálogo</a>
        <a href="/encomendas">Encomendas</a>
        <a href="/conta">Área do cliente</a>
        <a href="/pedidos">Meus pedidos</a>
      </nav>
      <main className="store-main delivery-catalog">
        <div className="catalog-store-info">
          <div
            className={"store-status " + (loaded && status.open ? "open" : "")}
            role="status"
          >
            <Clock3 size={17} />
            {loaded ? status.label : "Consultando horário…"}
          </div>
          <span>{loaded ? status.detail : ""}</span>
          {loaded && status.open && (
            <span className="prep-estimate">
              {config.prepMin}–{config.prepMax} min
            </span>
          )}
          <button
            className="address-shortcut"
            onClick={() => setAddressModal(true)}
          >
            <MapPin size={17} />
            {quote ? "Entrega: " + money(quote.fee) : "Consultar entrega"}
          </button>
        </div>
        <section id="catalogo">
          <div className="catalog-heading">
            <div>
              <div className="eyebrow">FEITO À MÃO, COM O CORAÇÃO</div>
              <h1>Seu dia merece um doce.</h1>
              <p>Escolha seu favorito. A gente cuida do carinho.</p>
            </div>
            <span className="catalog-count">{products.length} produtos</span>
          </div>
          <div className="catalog-tools">
            <Tabs
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                history.replaceState(
                  null,
                  "",
                  value === "Todos os doces"
                    ? "/catalogo"
                    : "/categoria/" + categorySlug(value),
                );
              }}
            >
              <TabsList className="category-list">
                {availableCategories.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Buscar doce"
                placeholder="Qual doce você procura?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {loadError && (
            <div className="notice error">
              {loadError}
              <button onClick={load}>Tentar novamente</button>
            </div>
          )}
          <div className="product-grid">
            {visible.map((p, index) => (
              <article className="product-card" key={p.id}>
                <button
                  className="product-image"
                  onClick={() => selectProduct(p)}
                  aria-label={"Ver " + p.name}
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    width={1200}
                    height={1200}
                    loading={index < 2 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                  {(p.tag || p.sold_out || p.stock === 0) && (
                    <span className="product-tag">
                      {p.sold_out || p.stock === 0 ? "Esgotado" : p.tag}
                    </span>
                  )}
                  <span className="product-peek">
                    Ver detalhes <ArrowUpRight size={15} />
                  </span>
                </button>
                <div className="product-copy">
                  <div className="product-category">{p.category}</div>
                  <button
                    className="product-title"
                    onClick={() => selectProduct(p)}
                  >
                    {p.name}
                  </button>
                  <p>{p.description}</p>
                  <div className="product-bottom">
                    <strong>{money(p.price)}</strong>
                    <button
                      disabled={!!p.sold_out || p.stock === 0}
                      className="add-button"
                      onClick={() => add(p.id)}
                      aria-label={"Adicionar " + p.name}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="product-social-bar">
                    <button
                      onClick={() => shareProduct(p)}
                      aria-label={"Compartilhar " + p.name}
                    >
                      <Share2 size={17} />
                      <span>Compartilhar</span>
                    </button>
                    <button
                      className={p.liked ? "liked" : ""}
                      onClick={() => selectProduct(p)}
                      aria-label={"Curtidas e comentários de " + p.name}
                    >
                      <Heart
                        size={17}
                        fill={p.liked ? "currentColor" : "none"}
                      />
                      {p.likes || 0}
                      <MessageCircle size={17} />
                      {p.comments || 0}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="empty-state">
              <img src="/avatar.jpg" className="empty-brand" alt="" />
              <h3>
                {products.length
                  ? "Não encontramos esse doce"
                  : "O cardápio está sendo preparado"}
              </h3>
              <p>
                {products.length
                  ? "Tente outro nome ou uma categoria diferente."
                  : "Enquanto preparamos o cardápio, você pode solicitar um bolo ou docinhos para sua comemoração."}
              </p>
              {!products.length && (
                <a className="btn-link" href="/encomendas">
                  Encomendar um carinho <ArrowUpRight size={17} />
                </a>
              )}
              {products.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setCategory("Todos os doces");
                  }}
                >
                  Ver todos os doces
                </Button>
              )}
            </div>
          )}
        </section>
        <a className="celebration-banner" href="/encomendas">
          <img
            src="/images/celebration.webp"
            alt="Fatia de bolo com morangos, imagem ilustrativa"
            width={320}
            height={240}
            loading="lazy"
          />
          <div>
            <span className="eyebrow">MOMENTOS PARA CELEBRAR</span>
            <h2>Um doce do seu jeito.</h2>
            <p>Bolos personalizados e docinhos feitos para a sua ocasião.</p>
            <strong>
              Solicitar encomenda <ArrowUpRight size={17} />
            </strong>
          </div>
        </a>
        <footer className="catalog-footer">
          <span>{config.name}</span>
          <a href="/painel">Painel da confeitaria</a>
        </footer>
      </main>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            history.replaceState(null, "", "/catalogo");
          }
        }}
      >
        <DialogContent className="product-dialog">
          {selected && (
            <>
              <img src={selected.image} alt={selected.name} />
              <div className="product-dialog-copy">
                <DialogHeader>
                  <div className="eyebrow">{selected.category}</div>
                  <DialogTitle>{selected.name}</DialogTitle>
                  <DialogDescription>{selected.description}</DialogDescription>
                </DialogHeader>
                <p className="allergen-note">
                  Alergias ou restrições? Confirme os ingredientes com a
                  confeitaria antes de pedir.
                </p>
                <div className="product-dialog-action">
                  <div className="quantity">
                    <button
                      aria-label="Diminuir quantidade"
                      disabled={selectedQty <= 1}
                      onClick={() => setSelectedQty((q) => q - 1)}
                    >
                      <Minus size={15} />
                    </button>
                    <span>{selectedQty}</span>
                    <button
                      aria-label="Aumentar quantidade"
                      disabled={
                        selectedQty >= Math.min(30, selected.stock ?? 30)
                      }
                      onClick={() => setSelectedQty((q) => q + 1)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <Button
                    disabled={!!selected.sold_out || selected.stock === 0}
                    onClick={() => {
                      add(selected.id, selectedQty);
                      setSelected(null);
                    }}
                  >
                    Adicionar · {money(selected.price * selectedQty)}
                  </Button>
                </div>
                <ProductSocial
                  product={selected}
                  signedIn={signedIn}
                  onChange={updateSocial}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={addressModal} onOpenChange={setAddressModal}>
        <DialogContent className="address-dialog">
          <DialogHeader>
            <div className="eyebrow">CHEGANDO ATÉ VOCÊ</div>
            <DialogTitle>Onde entregamos seu carinho?</DialogTitle>
            <DialogDescription>
              Informe o endereço completo para consultar a distância e o valor
              da entrega.
            </DialogDescription>
          </DialogHeader>
          <>
            <AddressFields value={address} onChange={updateAddress} />
            {quote && (
              <div className="quote-result">
                <Check size={18} />
                <span>
                  {(quote.distance / 1000).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  km pela rota de entrega<strong>{money(quote.fee)}</strong>
                </span>
              </div>
            )}
            <Button onClick={calculate} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <MapPin size={18} />}
              Calcular entrega
            </Button>
            {!deliveryAvailable && (
              <p className="small-muted">
                A loja ainda está configurando a área de entrega.
              </p>
            )}
          </>
        </DialogContent>
      </Dialog>
      <Sheet open={bag} onOpenChange={setBag}>
        <SheetContent className="checkout-sheet">
          <SheetHeader className="bag-header">
            <SheetTitle>
              {success
                ? "Seu pedido está aqui"
                : step === 0
                  ? "Sua sacola"
                  : "Quase na sua casa"}
            </SheetTitle>
            <SheetDescription>
              {success
                ? "Acompanhe cada etapa em Meus pedidos."
                : step === 0
                  ? "Um pouquinho de felicidade para levar."
                  : "Faltam poucos passos para adoçar seu dia."}
            </SheetDescription>
          </SheetHeader>
          {success ? (
            <div className="bag-body success-state">
              <div className="success-icon">
                <PackageCheck size={36} />
              </div>
              <h2>Pedido recebido!</h2>
              <p>
                Pedido <strong>#{success.code}</strong>
              </p>
              <OrderPayment order={success} />
              <div className="summary-line total">
                <span>Total</span>
                <strong>{money(success.total)}</strong>
              </div>
              {success.checkout_url && (
                <a
                  className="primary-action as-button"
                  href={success.checkout_url}
                >
                  Ir para pagamento seguro <ArrowUpRight size={18} />
                </a>
              )}
              <a className="btn-link secondary" href="/pedidos">
                Acompanhar pedido <ArrowRight size={18} />
              </a>
              {!signedIn && (
                <p className="small-muted">
                  Pedido como convidado: acompanhe neste navegador. Você também
                  pode salvar o resumo em PDF.
                </p>
              )}
              <p className="small-muted">
                {"O resumo do seu pedido está salvo em Meus pedidos."}
              </p>
            </div>
          ) : (
            <>
              <div className="checkout-steps">
                {["Sacola", "Entrega", "Cadastro", "Pagamento"].map((s, i) => (
                  <span
                    className={i === step ? "current" : i < step ? "done" : ""}
                    key={s}
                  >
                    <b>{i < step ? <Check size={12} /> : i + 1}</b>
                    {s}
                  </span>
                ))}
              </div>
              <div className="bag-body">
                {step > 0 && (
                  <button
                    className="back-button"
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <ArrowLeft size={16} /> Voltar
                  </button>
                )}
                {step === 0 && (
                  <>
                    {items.length ? (
                      items.map(({ product: p, quantity }) => (
                        <div className="bag-item" key={p.id}>
                          <img src={p.image} alt="" />
                          <div>
                            <h3>{p.name}</h3>
                            <span>{money(p.price)}</span>
                            {(p.sold_out ||
                              p.stock === 0 ||
                              (p.stock != null && quantity > p.stock)) && (
                              <p className="error-text">
                                Quantidade indisponível. Ajuste ou remova este
                                item.
                              </p>
                            )}

                            <div className="quantity">
                              <button
                                aria-label={"Diminuir " + p.name}
                                onClick={() => adjust(p.id, -1)}
                              >
                                {quantity === 1 ? (
                                  <Trash2 size={13} />
                                ) : (
                                  <Minus size={14} />
                                )}
                              </button>
                              <span>{quantity}</span>
                              <button
                                aria-label={"Aumentar " + p.name}
                                disabled={
                                  quantity >= Math.min(30, p.stock ?? 30)
                                }
                                onClick={() => adjust(p.id, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                          <strong>{money(p.price * quantity)}</strong>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <ShoppingBag size={42} />
                        <h3>Sua sacola espera um carinho</h3>
                        <p>Escolha um doce do nosso cardápio para começar.</p>
                        <Button onClick={() => setBag(false)}>
                          Explorar cardápio
                        </Button>
                      </div>
                    )}
                    {count > 0 && (
                      <div className="order-note">

                        <Label htmlFor="note">Alguma observação?</Label>
                        <Textarea
                          id="note"
                          maxLength={500}
                          rows={2}
                          placeholder="Conte aqui algum detalhe do seu pedido…"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>
                    )}
                    {count > 0 && !signedIn && (
                      <div className="guest-choice form-stack">
                        <p>
                          {customerExists ? `Bem-vindo de volta, ${profile.name.split(' ')[0]}!` : "Informe seu telefone para continuar."}
                        </p>
                        <Label htmlFor="customer-phone">Telefone com DDD</Label>
                        <Input
                          id="customer-phone"
                          autoComplete="tel-national"
                          inputMode="tel"
                          maxLength={15}
                          value={profile.phone}
                          onChange={(e) => {
                            setProfile((p) => ({ ...p, phone: formatPhone(e.target.value) }));
                            if (customerExists) setCustomerExists(false);
                          }}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    )}
                  </>
                )}
                {step === 2 && (
                  <div className="form-stack">
                    <div className="step-heading">
                      <h3>Vamos nos conhecer?</h3>
                      <p>
                        {signedIn
                          ? "Seus dados ficam salvos para os próximos pedidos."
                          : "Informe os dados necessários para este pedido."}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="customer-name">Nome completo</Label>
                      <Input
                        id="customer-name"
                        autoComplete="name"
                        value={profile.name}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Como podemos chamar você?"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer-phone">Telefone com DDD</Label>
                      <Input
                        id="customer-phone"
                        autoComplete="tel-national"
                        inputMode="tel"
                        maxLength={15}
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, phone: formatPhone(e.target.value) }))
                        }
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer-email">
                        E-mail <span className="muted">(opcional)</span>
                      </Label>
                      <Input
                        id="customer-email"
                        type="email"
                        autoComplete="email"
                        value={profile.email || ""}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, email: e.target.value }))
                        }
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer-cpf">
                        CPF <span className="muted">(opcional)</span>
                      </Label>
                      <Input
                        id="customer-cpf"
                        inputMode="numeric"
                        maxLength={14}
                        value={profile.cpf}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, cpf: e.target.value }))
                        }
                        placeholder="000.000.000-00"
                      />
                    </div>
                    {!customerExists && (
                      <div>
                        <Label htmlFor="customer-password">
                          Crie uma senha <span className="muted">(opcional)</span>
                        </Label>
                        <Input
                          id="customer-password"
                          type="password"
                          value={profile.password || ""}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, password: e.target.value }))
                          }
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    )}
                    <label className="consent">
                      <Checkbox
                        checked={profile.whatsappConsent}
                        onCheckedChange={(v) =>
                          setProfile((p) => ({
                            ...p,
                            whatsappConsent: v === true,
                          }))
                        }
                      />
                      <span>
                        Quero receber o resumo e as informações deste pedido no
                        meu WhatsApp.
                      </span>
                    </label>
                    <p className="small-muted">
                      Usamos seu cadastro para identificar o pedido, entrar em
                      contato e realizar a entrega. Seus dados de contato não
                      aparecem no catálogo.
                    </p>
                  </div>
                )}
                {step === 1 && (
                  <div className="form-stack">
                    <div className="step-heading">
                      <h3>Como prefere receber?</h3>
                    </div>
                    {deliveryOptions}
                    {delivery === "delivery" ? (
                      <>
                        <AddressFields
                          value={address}
                          onChange={updateAddress}
                        />
                        <Button
                          variant="outline"
                          onClick={calculate}
                          disabled={busy}
                        >
                          {busy ? (
                            <LoaderCircle className="spin" />
                          ) : (
                            <MapPin size={16} />
                          )}{" "}
                          Calcular frete
                        </Button>
                        {quote && (
                          <div className="quote-result">
                            <Check size={18} />
                            <span>
                              Entrega ·{" "}
                              {(quote.distance / 1000).toLocaleString("pt-BR", {
                                maximumFractionDigits: 1,
                              })}{" "}
                              km<strong>{money(quote.fee)}</strong>
                            </span>
                          </div>
                        )}
                        <p className="small-muted">
                          Taxa base + valor por km percorrido. Cotação válida
                          por 15 minutos.
                        </p>
                      </>
                    ) : (
                      <div className="pickup-address">
                        <Store size={25} />
                        <h3>Retire na confeitaria</h3>
                        <p>
                          {config.storeAddress ||
                            "O endereço de retirada será informado pela loja."}
                        </p>
                        <strong>Sem taxa de entrega</strong>
                      </div>
                    )}
                  </div>
                )}
                {step === 3 && (
                  <div className="form-stack">
                    <div className="step-heading">
                      <h3>Como deseja pagar?</h3>
                      <p>Escolha a melhor opção para você.</p>
                    </div>
                    <RadioGroup
                      value={payment}
                      onValueChange={setPayment}
                      className="payment-options"
                    >
                      {[
                        {
                          id: "pix",
                          label: "Pix",
                          text: online
                            ? "Pague agora · confirmação automática"
                            : "Enviar comprovante para conferência",
                          icon: Diamond,
                          enabled: online || (!!config.pixKey && !prepaid),
                        },
                        {
                          id: "card",
                          label: "Cartão online",
                          text:
                            config.paymentProvider === "mercadopago"
                              ? "Pague agora com segurança"
                              : "Pague no ambiente seguro do provedor",
                          icon: CreditCard,
                          enabled:
                            online && config.paymentProvider !== "picpay",
                        },
                        {
                          id: "card_machine",
                          label:
                            delivery === "pickup"
                              ? "Maquininha na retirada"
                              : "Maquininha na entrega",
                          text:
                            delivery === "pickup"
                              ? "Pague ao retirar na confeitaria"
                              : "O entregador levará a maquininha",
                          icon: CreditCard,
                          enabled: config.cardOnDelivery && !prepaid,
                        },
                        {
                          id: "cash",
                          label: "Dinheiro",
                          text:
                            delivery === "pickup"
                              ? "Pague na retirada"
                              : "Pague na entrega",
                          icon: Banknote,
                          enabled: config.cash && !prepaid,
                        },
                      ]
                        .filter(
                          (p) =>
                            p.enabled &&
                            paymentAllowed(
                              config,
                              delivery,
                              p.id as PaymentMethod,
                              online,
                            ),
                        )
                        .map((p) => (
                          <label
                            className={
                              "choice " +
                              (payment === p.id ? "active" : "") +
                              (!p.enabled ? " unavailable" : "")
                            }
                            key={p.id}
                          >
                            <RadioGroupItem
                              value={p.id}
                              disabled={!p.enabled}
                            />
                            <p.icon size={22} />
                            <span>
                              {p.label}
                              <small>{p.text}</small>
                            </span>
                          </label>
                        ))}
                    </RadioGroup>
                    {prepaid && (
                      <p className="notice">
                        Para reservar e preparar sua retirada, a confeitaria
                        exige pagamento antecipado.
                      </p>
                    )}
                    {payment === "pix" &&
                      online &&
                      ["mercadopago", "picpay"].includes(
                        config.paymentProvider,
                      ) && (
                        <div className="form-stack">
                          <p className="small-muted">
                            O provedor precisa destes dados para gerar o Pix.
                          </p>
                          <label className="field">
                            <span>CPF</span>
                            <Input
                              inputMode="numeric"
                              maxLength={14}
                              value={profile.cpf}
                              onChange={(e) =>
                                setProfile((p) => ({
                                  ...p,
                                  cpf: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>E-mail para pagamento</span>
                            <Input
                              type="email"
                              autoComplete="email"
                              value={profile.email || ""}
                              onChange={(e) =>
                                setProfile((p) => ({
                                  ...p,
                                  email: e.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      )}
                    {payment === "cash" && (
                      <div>
                        <Label htmlFor="change">
                          Troco para quanto?{" "}
                          <span className="muted">(opcional)</span>
                        </Label>
                        <Input
                          id="change"
                          inputMode="decimal"
                          placeholder="R$ 0,00 · deixe vazio se não precisa"
                          value={change}
                          onChange={(e) => setChange(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="final-review">
                      <strong>
                        {delivery === "pickup"
                          ? "Retirada na confeitaria"
                          : "Entrega para " + profile.name.split(" ")[0]}
                      </strong>
                      <p>
                        {delivery === "pickup"
                          ? config.storeAddress
                          : addressText(address)}
                      </p>
                      <button onClick={() => setStep(2)}>Alterar</button>
                    </div>
                    {!status.open && (
                      <div className="notice">
                        A loja ainda não está recebendo pedidos. Você pode
                        explorar o catálogo enquanto preparamos tudo.
                      </div>
                    )}
                    {demo && (
                      <p className="small-muted">
                        Os produtos desta vitrine são exemplos. As compras
                        estarão disponíveis com o cardápio oficial.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {count > 0 && (
                <div className="bag-footer">
                  <div className="summary-line">
                    <span>
                      Subtotal · {count} {count === 1 ? "item" : "itens"}
                    </span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div className="summary-line">
                    <span>
                      {delivery === "pickup" ? "Retirada" : "Entrega"}
                    </span>
                    <span>
                      {delivery === "pickup"
                        ? "Grátis"
                        : quote
                          ? money(quote.fee)
                          : "A calcular"}
                    </span>
                  </div>
                  <div className="summary-line total">
                    <span>
                      {step === 3 ? "Total do pedido" : "Total parcial"}
                    </span>
                    <strong>{money(total)}</strong>
                  </div>
                  {step === 0 ? (
                    <Button
                      className="primary-action"
                      disabled={busy}
                      onClick={continueBag}
                    >
                      {busy
                        ? "Aguarde…"
                        : "Continuar pedido"}{" "}
                      <ArrowRight size={17} />
                    </Button>
                  ) : step === 1 ? (
                    <Button
                      className="primary-action"
                      onClick={continueDelivery}
                    >
                      Continuar <ArrowRight size={17} />
                    </Button>
                  ) : step === 2 ? (
                    <Button
                      className="primary-action"
                      disabled={busy}
                      onClick={saveProfile}
                    >
                      Ir para pagamento <ArrowRight size={17} />
                    </Button>
                  ) : (
                    <Button
                      className="primary-action"
                      disabled={
                        busy ||
                        !status.open ||
                        demo ||
                        !paymentAllowed(
                          config,
                          delivery,
                          payment as PaymentMethod,
                          online,
                        ) ||
                        (!config.cash && payment === "cash") ||
                        (!online && payment === "card") ||
                        (payment === "card_machine" &&
                          (!config.cardOnDelivery || prepaid)) ||
                        (payment === "cash" && prepaid) ||
                        (!online && !config.pixKey && payment === "pix")
                      }
                      onClick={placeOrder}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" />
                      ) : (
                        <ShoppingBag size={17} />
                      )}
                      Confirmar pedido · {money(total)}
                    </Button>
                  )}
                  {step === 0 && (
                    <p className="small-muted centered">
                      Entrega calculada no próximo passo.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
