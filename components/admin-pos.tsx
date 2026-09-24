import { useState, useMemo } from 'react';
import { ShoppingBag, Plus, Minus, Search, Check, Store, MapPin, X, LoaderCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { money, type Product } from '@/lib/commerce';

type CartItem = Product & { quantity: number; note: string };

export default function AdminPOS({ products, onSaved, onClose }: { products: Product[], onSaved: () => void, onClose: () => void }) {
  const [step, setStep] = useState<'cart' | 'customer' | 'payment'>('cart');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  
  // Customer State
  const [searchCustomer, setSearchCustomer] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', cpf: '', email: '' });
  const [address, setAddress] = useState<any>({ street: '', number: '', complement: '', district: '', city: '', state: '', cep: '', location: null });
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  
  // Order State
  const [delivery, setDelivery] = useState<'delivery' | 'pickup'>('pickup');
  const [fee, setFee] = useState('0,00');
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState<'pix' | 'cash' | 'card_machine'>('pix');
  const [paid, setPaid] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  
  // Custom Order State
  const [orderType, setOrderType] = useState<'normal'|'custom'>('normal');
  const [customDescription, setCustomDescription] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [orderDate, setOrderDate] = useState(() => { const d = new Date(); d.setHours(d.getHours() - 3); return d.toISOString().split('T')[0]; });
  const [dueDate, setDueDate] = useState('');

  const filteredProducts = useMemo(() => {
    const q = searchProduct.toLowerCase();
    return products.filter(p => !p.demo && p.active && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
  }, [products, searchProduct]);

  const cartTotal = orderType === 'custom' ? Math.round(Number(customPrice.replace(',', '.')) * 100) || 0 : cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalFee = Math.round(Number(fee.replace(',', '.')) * 100) || 0;
  const discountPerc = Math.min(100, Math.max(0, Math.round(Number(discount)) || 0));
  const finalDiscount = Math.round(cartTotal * (discountPerc / 100));
  const total = cartTotal - finalDiscount + (delivery === 'delivery' ? finalFee : 0);

  function addToCart(p: Product) {
    setCart(current => {
      const existing = current.find(item => item.id === p.id);
      if (existing) {
        if (p.stock != null && existing.quantity >= p.stock) {
          toast.error('Estoque insuficiente para ' + p.name);
          return current;
        }
        return current.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      if (p.stock === 0) {
        toast.error(p.name + ' está esgotado.');
        return current;
      }
      return [...current, { ...p, quantity: 1, note: '' }];
    });
  }

  function updateQuantity(id: string, delta: number) {
    setCart(current => current.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        if (newQ < 1) return item;
        if (item.stock != null && newQ > item.stock) return item;
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  }

  function removeItem(id: string) {
    setCart(current => current.filter(item => item.id !== id));
  }

  async function searchCustomers(q: string) {
    setSearchCustomer(q);
    if (q.length < 3) { setCustomers([]); return; }
    setSearchingCustomers(true);
    try {
      const res = await api('admin/customers?q=' + encodeURIComponent(q));
      setCustomers(res.customers);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingCustomers(false);
    }
  }

  function selectExistingCustomer(c: any) {
    setSelectedCustomer(c);
    setCustomerForm({
      name: c.data.name || '',
      phone: c.data.phone || '',
      cpf: c.data.cpf || '',
      email: c.data.email || ''
    });
    if (c.data.address) {
      setAddress(c.data.address);
      if (c.data.address.location?.confirmed) {
        const { lat, lng } = c.data.address.location;
        setGoogleMapsUrl(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
        setDelivery('delivery');
        // Auto-calculate fee like the storefront does
        autoCalculateFee(c.data.address);
      }
    }
    if (c.data.googleMapsUrl) setGoogleMapsUrl(c.data.googleMapsUrl);
    setSearchCustomer('');
    setCustomers([]);
  }

  async function autoCalculateFee(addr: any) {
    setBusy(true);
    try {
      const confirmed = addr.location?.confirmed ? addr : { ...addr, location: await api('address/point', { method: 'POST', body: JSON.stringify(addr) }) };
      const quote = await api('admin/quote', { method: 'POST', body: JSON.stringify(confirmed) });
      if (quote.fee != null) {
        setFee((quote.fee / 100).toFixed(2).replace('.', ','));
        if (quote.distance) {
          toast.success(`Frete calculado: ${(quote.distance / 1000).toFixed(1).replace('.', ',')} km pela rota.`);
        } else {
          toast.success('Frete calculado com sucesso.');
        }
      }
    } catch (e) {
      toast.error('Não foi possível calcular o frete automaticamente. Insira o valor manualmente.');
    } finally {
      setBusy(false);
    }
  }

  async function calculateDistance() {
    if (!address.cep || !address.number) {
      toast.error('Preencha CEP e Número primeiro.');
      return;
    }
    setBusy(true);
    try {
      const location = await api('address/point', { method: 'POST', body: JSON.stringify(address) });
      const currentAddress = { ...address, location };
      setAddress(currentAddress);
      const quote = await api('admin/quote', { method: 'POST', body: JSON.stringify(currentAddress) });
      if (quote.fee != null) {
        setFee((quote.fee / 100).toFixed(2).replace('.', ','));
        toast.success('Frete calculado com sucesso.');
      }
    } catch (e) {
      toast.error('Não foi possível calcular o frete. Você pode inserir o valor manualmente.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder() {
    if (orderType === 'normal' && cart.length === 0) return toast.error('O carrinho está vazio');
    if (orderType === 'custom') {
      if (!customDescription.trim()) return toast.error('Informe a descrição da encomenda');
      if (cartTotal <= 0) return toast.error('Informe o valor da encomenda');
      if (!dueDate) return toast.error('Informe a data de entrega/retirada');
    }
    if (customerForm.name.trim().length < 3) return toast.error('Informe o nome do cliente');
    if (customerForm.phone.replace(/\D/g, '').length < 10) return toast.error('Informe um WhatsApp válido');
    if (delivery === 'delivery' && !address.street && !googleMapsUrl) return toast.error('Preencha o endereço ou cole o link do Google Maps');

    setBusy(true);
    try {
      await api('admin/pos-order', {
        method: 'POST',
        body: JSON.stringify({
          profile: {
            id: selectedCustomer?.user_id,
            name: customerForm.name,
            phone: customerForm.phone,
            cpf: customerForm.cpf,
            email: customerForm.email,
            address: address.street ? address : (googleMapsUrl && address.location ? { ...address, street: 'Localização via Mapa' } : undefined)
          },
          items: orderType === 'custom' ? [{ id: 'custom', quantity: 1, note: customDescription, name: 'Encomenda', price: cartTotal }] : cart.map(i => ({ id: i.id, quantity: i.quantity, note: i.note, name: i.name, price: i.price })),
          delivery,
          payment,
          fee: delivery === 'delivery' ? finalFee : 0,
          discountPercentage: discountPerc > 0 ? discountPerc : undefined,
          paid,
          note,
          googleMapsUrl: delivery === 'delivery' && googleMapsUrl ? googleMapsUrl : undefined,
          customOrder: orderType === 'custom',
          dueDate: orderType === 'custom' ? dueDate : undefined,
          orderDate: orderType === 'custom' ? orderDate : undefined
        })
      });
      toast.success('Pedido criado com sucesso!');
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-container">
      
      {/* Left side: Flow */}
      <div className="pos-flow">
        
        {/* Step Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e7dbd2', background: '#faf7f3' }}>
          {['cart', 'customer', 'payment'].map((s, i) => (
            <button 
              key={s} 
              onClick={() => setStep(s as any)}
              style={{ flex: 1, padding: '16px 12px', border: 0, background: step === s ? '#fffcf8' : 'transparent', fontWeight: step === s ? 600 : 400, color: step === s ? '#a43a57' : '#997c69', borderBottom: step === s ? '2px solid #a43a57' : '2px solid transparent' }}
            >
              {i + 1}. {{ cart: 'Itens', customer: 'Cliente', payment: 'Pagamento' }[s as 'cart' | 'customer' | 'payment']}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(90dvh - 180px)' }}>
          {step === 'cart' && (
            <div className="form-stack">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <Button variant={orderType === 'normal' ? 'default' : 'outline'} onClick={() => setOrderType('normal')} style={{ flex: 1 }}>Pedido normal</Button>
                <Button variant={orderType === 'custom' ? 'default' : 'outline'} onClick={() => setOrderType('custom')} style={{ flex: 1 }}>Encomenda</Button>
              </div>
              
              {orderType === 'custom' ? (
                <div className="form-stack">
                  <label className="field"><span>Data do pedido</span><Input type="date" required value={orderDate} onChange={e => setOrderDate(e.target.value)} /></label>
                  <label className="field"><span>Data de entrega/retirada</span><Input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
                  <label className="field"><span>Descrição (tamanho, ingredientes, adicionais)</span><Textarea required placeholder="Ex: Bolo 20 fatias, recheio de morango, decoração rosa..." rows={4} value={customDescription} onChange={e => setCustomDescription(e.target.value)} /></label>
                  <label className="field"><span>Valor total da encomenda (R$)</span><Input required inputMode="decimal" placeholder="0,00" value={customPrice} onChange={e => setCustomPrice(e.target.value)} /></label>
                </div>
              ) : (
                <>
                  <Input placeholder="Buscar produto pelo nome..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)} style={{ border: '1px solid #e5d7cb', borderRadius: '8px', padding: '10px', background: 'white', textAlign: 'left', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <div style={{ fontSize: '11px', color: '#a17e70', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.category}</div>
                        <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.2, height: '34px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                        <div style={{ fontSize: '13px', color: '#927868', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          {money(p.price)}
                          {p.stock != null && <span style={{ fontSize: '10px', background: '#f5eee7', padding: '2px 6px', borderRadius: '4px' }}>{p.stock} un</span>}
                        </div>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && <p style={{ fontSize: '13px', color: '#a18266' }}>Nenhum produto disponível.</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'customer' && (
            <div className="form-stack">
              <div style={{ position: 'relative' }}>
                <Label>Buscar cliente existente (opcional)</Label>
                <Input placeholder="Digite nome ou telefone para buscar..." value={searchCustomer} onChange={e => searchCustomers(e.target.value)} />
                {customers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e7dbd2', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: '4px' }}>
                    {customers.map(c => (
                      <button key={c.user_id} onClick={() => selectExistingCustomer(c)} style={{ width: '100%', padding: '12px', textAlign: 'left', borderBottom: '1px solid #e7dbd2', background: 'none', border: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{c.data.name}</div>
                        <div style={{ fontSize: '12px', color: '#927868' }}>{c.data.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e7dbd2', margin: '8px 0' }}></div>

              <Label>Dados do Cliente</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label className="field"><span>Nome Completo *</span><Input value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} /></label>
                <label className="field"><span>WhatsApp *</span><Input value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} placeholder="11999999999" /></label>
                <label className="field"><span>CPF (Opcional)</span><Input value={customerForm.cpf} onChange={e => setCustomerForm(f => ({ ...f, cpf: e.target.value }))} /></label>
                <label className="field"><span>E-mail (Opcional)</span><Input value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} /></label>
              </div>

              <div style={{ borderTop: '1px solid #e7dbd2', margin: '8px 0' }}></div>

              <Label>Entrega ou Retirada?</Label>
              <Select value={delivery} onValueChange={(v: any) => setDelivery(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Retirada na loja</SelectItem>
                  <SelectItem value="delivery">Entrega (Delivery)</SelectItem>
                </SelectContent>
              </Select>

              {delivery === 'delivery' && (
                <div style={{ background: '#fcf9f5', padding: '16px', borderRadius: '8px', border: '1px solid #eedfd4' }}>
                  <div className="form-stack">
                    <div className="form-grid">
                      <div><Label htmlFor="pos-cep">CEP</Label><Input id="pos-cep" inputMode="numeric" maxLength={9} value={address.cep} onChange={e => setAddress((a: any) => ({ ...a, cep: e.target.value }))} onBlur={async () => { const raw = address.cep.replace(/\D/g, ''); if (raw.length !== 8) return; try { const r = await api('address/cep?cep=' + raw); setAddress((a: any) => ({ ...a, ...r })); } catch {} }} placeholder="CEP" /></div>
                      <div><Label htmlFor="pos-number">Número</Label><Input id="pos-number" value={address.number} onChange={e => setAddress((a: any) => ({ ...a, number: e.target.value }))} placeholder="Número" /></div>
                    </div>
                    <div><Label htmlFor="pos-street">Rua / avenida</Label><Input id="pos-street" value={address.street} onChange={e => setAddress((a: any) => ({ ...a, street: e.target.value }))} placeholder="Rua / avenida" /></div>
                    <div><Label htmlFor="pos-district">Bairro</Label><Input id="pos-district" value={address.district} onChange={e => setAddress((a: any) => ({ ...a, district: e.target.value }))} placeholder="Bairro" /></div>
                    <div className="form-grid city-row">
                      <div><Label htmlFor="pos-city">Cidade</Label><Input id="pos-city" value={address.city} onChange={e => setAddress((a: any) => ({ ...a, city: e.target.value }))} placeholder="Cidade" /></div>
                      <div><Label htmlFor="pos-state">UF</Label><Input id="pos-state" maxLength={2} value={address.state} onChange={e => setAddress((a: any) => ({ ...a, state: e.target.value.toUpperCase() }))} placeholder="UF" /></div>
                    </div>
                    <div><Label htmlFor="pos-complement">Complemento <span className="muted">(opcional)</span></Label><Input id="pos-complement" value={address.complement} onChange={e => setAddress((a: any) => ({ ...a, complement: e.target.value }))} placeholder="Complemento (opcional)" /></div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '14px', background: '#fef9f2', border: '1px solid #e8d5c4', borderRadius: '8px' }}>
                    <Label htmlFor="pos-maps-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Link2 size={16} style={{ color: '#a43a57' }} />
                      Link do Google Maps
                    </Label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        id="pos-maps-link"
                        type="url"
                        value={googleMapsUrl}
                        onChange={e => setGoogleMapsUrl(e.target.value.trim())}
                        placeholder="Cole aqui o link do Google Maps..."
                        style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1 }}
                      />
                      <Button variant="secondary" type="button" disabled={busy || !googleMapsUrl} onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await api('admin/address/maps-link', { method: 'POST', body: JSON.stringify({ url: googleMapsUrl }) });
                          setAddress((prev:any) => ({ ...prev, location: { ...r.location, source: 'pin' } }));
                          toast.success('Localização extraída com sucesso!');
                          const quoteAddress = { ...r.address, location: { ...r.location, source: 'pin' } };
                          const safeAddress = { ...quoteAddress, number: 'S/N', cep: '00000-000', street: 'Local', district: 'Bairro', city: 'Cidade', state: 'XX' };
                          const quote = await api('admin/quote', { method: 'POST', body: JSON.stringify(safeAddress) });
                          if (quote.fee != null) {
                            setFee((quote.fee / 100).toFixed(2).replace('.', ','));
                            toast.success('Frete calculado com sucesso pela rota.');
                          }
                        } catch (e) {
                          toast.error(errorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}>Buscar e Calcular</Button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#a18266', marginTop: '6px' }}>
                      {googleMapsUrl
                        ? '✅ O QR Code com este link será incluído na nota do motoboy.'
                        : 'Abra o Google Maps, busque o endereço e cole o link de compartilhamento. O motoboy escaneará o QR Code para abrir a rota.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <Button variant="outline" type="button" disabled={busy} onClick={calculateDistance}>Calcular Frete</Button>
                    <label className="field" style={{ flex: 1, margin: 0 }}>
                      <span>Valor do Frete (R$)</span>
                      <Input value={fee} onChange={e => setFee(e.target.value)} placeholder="0,00" />
                    </label>
                  </div>
                  <p style={{ fontSize: '11px', color: '#a18266', marginTop: '8px' }}>O cálculo depende da configuração de rota da loja. Você pode sobrescrever o valor manualmente.</p>
                </div>
              )}
            </div>
          )}

          {step === 'payment' && (
            <div className="form-stack">
              <Label>Status do Pagamento</Label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setPaid(true)} style={{ flex: 1, padding: '14px', border: paid ? '1px solid #59713e' : '1px solid #e7dbd2', background: paid ? '#edf3e8' : 'white', color: paid ? '#59713e' : '#927868', borderRadius: '8px', fontWeight: 500 }}>
                  <Check size={16} style={{ display: 'inline', marginRight: '6px' }} /> Pedido já está pago
                </button>
                <button onClick={() => setPaid(false)} style={{ flex: 1, padding: '14px', border: !paid ? '1px solid #a43a57' : '1px solid #e7dbd2', background: !paid ? '#fff1f4' : 'white', color: !paid ? '#a43a57' : '#927868', borderRadius: '8px', fontWeight: 500 }}>
                  <Store size={16} style={{ display: 'inline', marginRight: '6px' }} /> Cobrar depois / na entrega
                </button>
              </div>

              <Label>Forma de Pagamento</Label>
              <Select value={payment} onValueChange={(v: any) => setPayment(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="card_machine">Maquininha (Débito/Crédito)</SelectItem>
                </SelectContent>
              </Select>

              <label className="field">
                <span>Desconto (%)</span>
                <Input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
              </label>

              <label className="field">
                <span>Observação do Pedido (Opcional)</span>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Anotações internas ou detalhes repassados pelo cliente..." />
              </label>

              <Button className="primary-action" size="lg" disabled={busy} onClick={submitOrder} style={{ marginTop: '24px' }}>
                {busy ? <LoaderCircle className="spin" /> : <Check />}
                Concluir Pedido ({money(total)})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart Summary */}
      <div className="pos-summary">
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px', display: 'flex', justifyContent: 'space-between' }}>
          Resumo <span style={{ color: '#927868', fontSize: '14px' }}>{cart.reduce((a, c) => a + c.quantity, 0)} itens</span>
        </h3>
        
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(90dvh - 320px)', marginBottom: '16px', paddingRight: '8px' }}>
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1e9e3', paddingBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: '13px', color: '#927868' }}>{money(item.price)}</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <div className="quantity" style={{ margin: 0, height: '28px', width: '80px' }}>
                    <button onClick={() => updateQuantity(item.id, -1)}><Minus size={12} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)}><Plus size={12} /></button>
                  </div>
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 0, color: '#a43a57', fontSize: '12px', textDecoration: 'underline' }}>Remover</button>
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p style={{ fontSize: '13px', color: '#a18266', textAlign: 'center', margin: '40px 0' }}>Adicione produtos ao carrinho</p>}
        </div>

        <div style={{ borderTop: '1px solid #e7dbd2', paddingTop: '16px' }}>
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{money(cartTotal)}</span>
          </div>
          {finalDiscount > 0 && (
            <div className="summary-line">
              <span style={{ color: '#a43a57' }}>Desconto ({discountPerc}%)</span>
              <span style={{ color: '#a43a57' }}>-{money(finalDiscount)}</span>
            </div>
          )}
          {delivery === 'delivery' && (
            <div className="summary-line">
              <span>Entrega</span>
              <span>{money(finalFee)}</span>
            </div>
          )}
          <div className="summary-line total" style={{ borderTop: '1px solid #e7dbd2', marginTop: '12px', paddingTop: '12px', fontSize: '18px' }}>
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Button variant="outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</Button>
            <Button style={{ flex: 1 }} onClick={() => setStep(step === 'cart' ? 'customer' : step === 'customer' ? 'payment' : 'payment')}>Próximo</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
