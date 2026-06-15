"""
Transformer architecture — "Attention Is All You Need" (Vaswani et al., 2017)
https://arxiv.org/abs/1706.03762
"""

import math
import copy

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Scaled Dot-Product Attention
# ---------------------------------------------------------------------------

def scaled_dot_product_attention(
    q: torch.Tensor,
    k: torch.Tensor,
    v: torch.Tensor,
    mask: torch.Tensor | None = None,
    dropout: nn.Dropout | None = None,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Computes Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V.

    Args:
        q: (..., seq_len_q, d_k)
        k: (..., seq_len_k, d_k)
        v: (..., seq_len_k, d_v)
        mask: broadcastable bool tensor; positions where mask==True are -inf.

    Returns:
        output: (..., seq_len_q, d_v)
        attn_weights: (..., seq_len_q, seq_len_k)
    """
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)  # (..., Tq, Tk)

    if mask is not None:
        scores = scores.masked_fill(mask, float("-inf"))

    attn_weights = F.softmax(scores, dim=-1)

    if dropout is not None:
        attn_weights = dropout(attn_weights)

    return torch.matmul(attn_weights, v), attn_weights


# ---------------------------------------------------------------------------
# Multi-Head Attention
# ---------------------------------------------------------------------------

class MultiHeadAttention(nn.Module):
    """
    Multi-Head Attention (section 3.2.2).

    Projects Q/K/V h times with different learned projections, runs
    scaled dot-product attention in parallel, concatenates, and projects.
    """

    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.0):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"

        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        self.W_q = nn.Linear(d_model, d_model, bias=False)
        self.W_k = nn.Linear(d_model, d_model, bias=False)
        self.W_v = nn.Linear(d_model, d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)

        self.attn_dropout = nn.Dropout(dropout)
        self.attn_weights: torch.Tensor | None = None  # stored for inspection

    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:
        """(B, T, d_model) -> (B, h, T, d_k)"""
        B, T, _ = x.shape
        return x.view(B, T, self.num_heads, self.d_k).transpose(1, 2)

    def _merge_heads(self, x: torch.Tensor) -> torch.Tensor:
        """(B, h, T, d_k) -> (B, T, d_model)"""
        B, _, T, _ = x.shape
        return x.transpose(1, 2).contiguous().view(B, T, self.d_model)

    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """
        Args:
            query:  (B, Tq, d_model)
            key:    (B, Tk, d_model)
            value:  (B, Tk, d_model)
            mask:   (B, 1, Tq, Tk) or (B, 1, 1, Tk) — True where ignored.

        Returns:
            (B, Tq, d_model)
        """
        q = self._split_heads(self.W_q(query))   # (B, h, Tq, d_k)
        k = self._split_heads(self.W_k(key))     # (B, h, Tk, d_k)
        v = self._split_heads(self.W_v(value))   # (B, h, Tk, d_k)

        x, self.attn_weights = scaled_dot_product_attention(
            q, k, v, mask=mask, dropout=self.attn_dropout
        )

        return self.W_o(self._merge_heads(x))    # (B, Tq, d_model)


# ---------------------------------------------------------------------------
# Position-wise Feed-Forward Network
# ---------------------------------------------------------------------------

class PositionwiseFeedForward(nn.Module):
    """
    FFN(x) = max(0, x W_1 + b_1) W_2 + b_2  (section 3.3).

    The inner dimension is d_ff = 4 * d_model in the paper.
    """

    def __init__(self, d_model: int, d_ff: int, dropout: float = 0.0):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ---------------------------------------------------------------------------
# Positional Encoding
# ---------------------------------------------------------------------------

class PositionalEncoding(nn.Module):
    """
    Fixed sinusoidal positional encoding (section 3.5).

    PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
    PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
    """

    def __init__(self, d_model: int, dropout: float = 0.0, max_len: int = 5_000):
        super().__init__()
        self.dropout = nn.Dropout(dropout)

        pe = torch.zeros(max_len, d_model)                          # (L, d)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)  # (L, 1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float) * (-math.log(10_000.0) / d_model)
        )                                                           # (d/2,)
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))                # (1, L, d)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, T, d_model)"""
        x = x + self.pe[:, : x.size(1)]
        return self.dropout(x)


# ---------------------------------------------------------------------------
# Encoder Layer & Encoder
# ---------------------------------------------------------------------------

class EncoderLayer(nn.Module):
    """One encoder layer: self-attention + FFN, each wrapped with Add & Norm."""

    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, src_mask: torch.Tensor | None = None) -> torch.Tensor:
        # Self-attention sub-layer
        x = self.norm1(x + self.dropout(self.self_attn(x, x, x, mask=src_mask)))
        # Feed-forward sub-layer
        x = self.norm2(x + self.dropout(self.ffn(x)))
        return x


class Encoder(nn.Module):
    """Stack of N encoder layers."""

    def __init__(self, layer: EncoderLayer, N: int):
        super().__init__()
        self.layers = nn.ModuleList([copy.deepcopy(layer) for _ in range(N)])
        self.norm = nn.LayerNorm(layer.self_attn.d_model)

    def forward(self, x: torch.Tensor, src_mask: torch.Tensor | None = None) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x, src_mask)
        return self.norm(x)


# ---------------------------------------------------------------------------
# Decoder Layer & Decoder
# ---------------------------------------------------------------------------

class DecoderLayer(nn.Module):
    """
    One decoder layer: masked self-attention + cross-attention + FFN,
    each wrapped with Add & Norm.
    """

    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.cross_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,
        memory: torch.Tensor,
        src_mask: torch.Tensor | None = None,
        tgt_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        # Masked self-attention
        x = self.norm1(x + self.dropout(self.self_attn(x, x, x, mask=tgt_mask)))
        # Cross-attention over encoder memory
        x = self.norm2(x + self.dropout(self.cross_attn(x, memory, memory, mask=src_mask)))
        # Feed-forward
        x = self.norm3(x + self.dropout(self.ffn(x)))
        return x


class Decoder(nn.Module):
    """Stack of N decoder layers."""

    def __init__(self, layer: DecoderLayer, N: int):
        super().__init__()
        self.layers = nn.ModuleList([copy.deepcopy(layer) for _ in range(N)])
        self.norm = nn.LayerNorm(layer.self_attn.d_model)

    def forward(
        self,
        x: torch.Tensor,
        memory: torch.Tensor,
        src_mask: torch.Tensor | None = None,
        tgt_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x, memory, src_mask, tgt_mask)
        return self.norm(x)


# ---------------------------------------------------------------------------
# Full Transformer
# ---------------------------------------------------------------------------

class Transformer(nn.Module):
    """
    Encoder-decoder Transformer (Vaswani et al., 2017).

    Default hyperparameters match the paper's base model:
        d_model=512, num_heads=8, N=6, d_ff=2048, dropout=0.1
    """

    def __init__(
        self,
        src_vocab_size: int,
        tgt_vocab_size: int,
        d_model: int = 512,
        num_heads: int = 8,
        N: int = 6,
        d_ff: int = 2048,
        dropout: float = 0.1,
        max_len: int = 5_000,
    ):
        super().__init__()

        self.d_model = d_model

        # Embeddings — shared weights if src/tgt vocabularies are the same
        self.src_embed = nn.Embedding(src_vocab_size, d_model)
        self.tgt_embed = nn.Embedding(tgt_vocab_size, d_model)
        self.pos_enc = PositionalEncoding(d_model, dropout, max_len)

        enc_layer = EncoderLayer(d_model, num_heads, d_ff, dropout)
        dec_layer = DecoderLayer(d_model, num_heads, d_ff, dropout)
        self.encoder = Encoder(enc_layer, N)
        self.decoder = Decoder(dec_layer, N)

        # Final linear projection to vocab logits (no softmax — use cross-entropy loss)
        self.output_proj = nn.Linear(d_model, tgt_vocab_size)

        self._init_weights()

    def _init_weights(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)
        # Scale embedding weights as in the paper (section 3.4)
        nn.init.normal_(self.src_embed.weight, mean=0, std=self.d_model ** -0.5)
        nn.init.normal_(self.tgt_embed.weight, mean=0, std=self.d_model ** -0.5)

    # ------------------------------------------------------------------
    # Mask helpers
    # ------------------------------------------------------------------

    @staticmethod
    def make_padding_mask(tokens: torch.Tensor, pad_idx: int = 0) -> torch.Tensor:
        """
        Returns a (B, 1, 1, T) bool mask — True where token == pad_idx.
        Broadcast-compatible with attention score shape (B, h, Tq, Tk).
        """
        return (tokens == pad_idx).unsqueeze(1).unsqueeze(2)

    @staticmethod
    def make_causal_mask(size: int, device: torch.device) -> torch.Tensor:
        """
        Returns an upper-triangular (1, 1, T, T) bool mask that prevents
        each position from attending to future positions.
        """
        mask = torch.triu(torch.ones(size, size, device=device), diagonal=1).bool()
        return mask.unsqueeze(0).unsqueeze(0)

    # ------------------------------------------------------------------
    # Forward
    # ------------------------------------------------------------------

    def encode(
        self,
        src: torch.Tensor,
        src_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        x = self.pos_enc(self.src_embed(src) * math.sqrt(self.d_model))
        return self.encoder(x, src_mask)

    def decode(
        self,
        tgt: torch.Tensor,
        memory: torch.Tensor,
        src_mask: torch.Tensor | None = None,
        tgt_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        x = self.pos_enc(self.tgt_embed(tgt) * math.sqrt(self.d_model))
        return self.decoder(x, memory, src_mask, tgt_mask)

    def forward(
        self,
        src: torch.Tensor,
        tgt: torch.Tensor,
        src_pad_idx: int = 0,
        tgt_pad_idx: int = 0,
    ) -> torch.Tensor:
        """
        Args:
            src: (B, Ts) — source token ids
            tgt: (B, Tt) — target token ids (teacher-forced, shifted right)

        Returns:
            logits: (B, Tt, tgt_vocab_size)
        """
        src_mask = self.make_padding_mask(src, src_pad_idx)

        # Combine padding mask and causal mask for the decoder's self-attention
        tgt_pad_mask = self.make_padding_mask(tgt, tgt_pad_idx)
        tgt_causal = self.make_causal_mask(tgt.size(1), tgt.device)
        tgt_mask = tgt_pad_mask | tgt_causal

        memory = self.encode(src, src_mask)
        out = self.decode(tgt, memory, src_mask, tgt_mask)
        return self.output_proj(out)


# ---------------------------------------------------------------------------
# Greedy decoder (inference utility)
# ---------------------------------------------------------------------------

@torch.no_grad()
def greedy_decode(
    model: Transformer,
    src: torch.Tensor,
    bos_idx: int,
    eos_idx: int,
    max_len: int = 100,
    src_pad_idx: int = 0,
) -> torch.Tensor:
    """
    Greedy autoregressive decoding for a single source sequence.

    Args:
        src: (1, Ts) — single source sequence
        bos_idx: beginning-of-sequence token id
        eos_idx: end-of-sequence token id

    Returns:
        (1, T) — generated token ids including BOS, excluding EOS
    """
    model.eval()
    device = src.device

    src_mask = model.make_padding_mask(src, src_pad_idx)
    memory = model.encode(src, src_mask)

    tgt = torch.full((1, 1), bos_idx, dtype=torch.long, device=device)

    for _ in range(max_len - 1):
        tgt_mask = model.make_causal_mask(tgt.size(1), device)
        out = model.decode(tgt, memory, src_mask, tgt_mask)
        next_token = model.output_proj(out[:, -1]).argmax(dim=-1, keepdim=True)
        tgt = torch.cat([tgt, next_token], dim=1)
        if next_token.item() == eos_idx:
            break

    return tgt


# ---------------------------------------------------------------------------
# Noam learning-rate schedule (from the paper, section 5.3)
# ---------------------------------------------------------------------------

class NoamScheduler(torch.optim.lr_scheduler.LambdaLR):
    """
    lrate = d_model^{-0.5} * min(step^{-0.5}, step * warmup^{-1.5})
    """

    def __init__(self, optimizer: torch.optim.Optimizer, d_model: int, warmup_steps: int = 4000):
        self.d_model = d_model
        self.warmup = warmup_steps
        super().__init__(optimizer, lr_lambda=self._rate)

    def _rate(self, step: int) -> float:
        step = max(step, 1)
        return self.d_model ** -0.5 * min(step ** -0.5, step * self.warmup ** -1.5)


# ---------------------------------------------------------------------------
# Label smoothing loss (section 5.4)
# ---------------------------------------------------------------------------

class LabelSmoothingLoss(nn.Module):
    """
    Cross-entropy with label smoothing ε (ε=0.1 in the paper).
    Ignores positions with target == ignore_index.
    """

    def __init__(self, vocab_size: int, ignore_index: int = 0, smoothing: float = 0.1):
        super().__init__()
        self.vocab_size = vocab_size
        self.ignore_index = ignore_index
        self.smoothing = smoothing

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        logits:  (B, T, V)
        targets: (B, T)
        """
        B, T, V = logits.shape
        logits = logits.view(-1, V)
        targets = targets.view(-1)

        log_probs = F.log_softmax(logits, dim=-1)

        # Smooth target distribution
        with torch.no_grad():
            smooth = torch.full_like(log_probs, self.smoothing / (V - 2))
            smooth.scatter_(1, targets.unsqueeze(1).clamp(min=0), 1.0 - self.smoothing)
            smooth[:, self.ignore_index] = 0.0

        loss = -(smooth * log_probs).sum(dim=-1)

        # Zero out padding positions
        non_pad = targets.ne(self.ignore_index)
        loss = loss[non_pad].mean()
        return loss


# ---------------------------------------------------------------------------
# Quick sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    PAD, BOS, EOS = 0, 1, 2
    SRC_VOCAB, TGT_VOCAB = 1000, 1000
    B, Ts, Tt = 4, 20, 18

    model = Transformer(
        src_vocab_size=SRC_VOCAB,
        tgt_vocab_size=TGT_VOCAB,
        d_model=512,
        num_heads=8,
        N=6,
        d_ff=2048,
        dropout=0.1,
    )
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Parameters: {total_params:,}")   # ~65 M for base model

    src = torch.randint(3, SRC_VOCAB, (B, Ts))
    tgt = torch.randint(3, TGT_VOCAB, (B, Tt))
    src[:, -3:] = PAD  # add some padding

    logits = model(src, tgt, src_pad_idx=PAD, tgt_pad_idx=PAD)
    print(f"Logits shape: {logits.shape}")   # (4, 18, 1000)

    criterion = LabelSmoothingLoss(TGT_VOCAB, ignore_index=PAD, smoothing=0.1)
    loss = criterion(logits, tgt)
    print(f"Loss: {loss.item():.4f}")

    optimizer = torch.optim.Adam(model.parameters(), betas=(0.9, 0.98), eps=1e-9)
    scheduler = NoamScheduler(optimizer, d_model=512, warmup_steps=4000)
    loss.backward()
    optimizer.step()
    scheduler.step()
    print(f"LR after step 1: {scheduler.get_last_lr()[0]:.6f}")

    # Greedy decode a single source
    out = greedy_decode(model, src[:1], bos_idx=BOS, eos_idx=EOS, max_len=30)
    print(f"Decoded tokens: {out}")
