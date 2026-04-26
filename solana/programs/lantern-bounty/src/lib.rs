use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Bounty11111111111111111111111111111111111111");

#[program]
pub mod lantern_bounty {
    use super::*;

    /// Journalist creates a bounty pool for a specific beat and deposits SOL.
    /// Total deposit = amount_per_claim * max_claims. The pool PDA itself escrows the SOL.
    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        beat_slug: String,
        amount_per_claim: u64,
        max_claims: u32,
    ) -> Result<()> {
        require!(beat_slug.as_bytes().len() <= 32, LanternError::SlugTooLong);
        require!(amount_per_claim >= 1_000_000, LanternError::AmountTooSmall);
        require!(max_claims > 0, LanternError::InvalidMaxClaims);

        let pool = &mut ctx.accounts.pool;
        pool.journalist = ctx.accounts.journalist.key();
        pool.claim_authority = ctx.accounts.claim_authority.key();
        pool.beat_slug = beat_slug;
        pool.amount_per_claim = amount_per_claim;
        pool.max_claims = max_claims;
        pool.claims_paid = 0;
        pool.active = true;
        pool.bump = ctx.bumps.pool;

        let deposit = amount_per_claim
            .checked_mul(max_claims as u64)
            .ok_or(LanternError::Overflow)?;

        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.journalist.to_account_info(),
                to: pool.to_account_info(),
            },
        );
        system_program::transfer(cpi, deposit)?;

        Ok(())
    }

    /// Server claim authority pays a single bounty to an ephemeral recipient wallet.
    /// `claim_hash` (sha256(tip_id + nullifier_hash)) is opaque on-chain — only the server
    /// can derive it because only the server knows both inputs. The init of the
    /// ClaimReceipt PDA seeded by claim_hash makes double-claims impossible.
    pub fn claim_bounty(
        ctx: Context<ClaimBounty>,
        claim_hash: [u8; 32],
        _beat_slug: String,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let amount = pool.amount_per_claim;

        // Manual lamport movement: the pool is a program-owned data account, so we must
        // adjust lamports directly rather than use system_program::transfer.
        let pool_info = pool.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();

        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(pool_info.data_len());
        let pool_lamports = pool_info.lamports();
        require!(
            pool_lamports >= min_balance.checked_add(amount).ok_or(LanternError::Overflow)?,
            LanternError::InsufficientPoolBalance
        );

        **pool_info.try_borrow_mut_lamports()? = pool_lamports
            .checked_sub(amount)
            .ok_or(LanternError::InsufficientPoolBalance)?;
        **recipient_info.try_borrow_mut_lamports()? = recipient_info
            .lamports()
            .checked_add(amount)
            .ok_or(LanternError::Overflow)?;

        pool.claims_paid = pool
            .claims_paid
            .checked_add(1)
            .ok_or(LanternError::Overflow)?;
        if pool.claims_paid >= pool.max_claims {
            pool.active = false;
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.claim_hash = claim_hash;
        receipt.pool = pool.key();
        receipt.paid_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    /// Journalist closes the pool and reclaims any remaining escrow.
    pub fn close_bounty(_ctx: Context<CloseBounty>, _beat_slug: String) -> Result<()> {
        // Anchor handles the close: lamports + rent return to journalist, account is zeroed.
        Ok(())
    }

    /// Journalist adds more claims to an existing pool (deposits more SOL).
    pub fn top_up_bounty(
        ctx: Context<TopUpBounty>,
        _beat_slug: String,
        additional_claims: u32,
    ) -> Result<()> {
        require!(additional_claims > 0, LanternError::InvalidMaxClaims);

        let pool = &mut ctx.accounts.pool;
        let deposit = pool
            .amount_per_claim
            .checked_mul(additional_claims as u64)
            .ok_or(LanternError::Overflow)?;

        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.journalist.to_account_info(),
                to: pool.to_account_info(),
            },
        );
        system_program::transfer(cpi, deposit)?;

        pool.max_claims = pool
            .max_claims
            .checked_add(additional_claims)
            .ok_or(LanternError::Overflow)?;
        pool.active = true;

        Ok(())
    }
}

// Layout: discriminator (8) + journalist (32) + claim_authority (32)
//   + beat_slug (4 + 32) + amount_per_claim (8) + max_claims (4) + claims_paid (4)
//   + active (1) + bump (1) = 126 bytes; round to 128 for safety.
#[account]
pub struct BountyPool {
    pub journalist: Pubkey,
    pub claim_authority: Pubkey,
    pub beat_slug: String,
    pub amount_per_claim: u64,
    pub max_claims: u32,
    pub claims_paid: u32,
    pub active: bool,
    pub bump: u8,
}

// Layout: discriminator (8) + claim_hash (32) + pool (32) + paid_at (8) = 80 bytes.
#[account]
pub struct ClaimReceipt {
    pub claim_hash: [u8; 32],
    pub pool: Pubkey,
    pub paid_at: i64,
}

#[derive(Accounts)]
#[instruction(beat_slug: String, amount_per_claim: u64, max_claims: u32)]
pub struct CreateBounty<'info> {
    #[account(
        init,
        payer = journalist,
        space = 8 + 32 + 32 + (4 + 32) + 8 + 4 + 4 + 1 + 1,
        seeds = [b"bounty_pool", journalist.key().as_ref(), beat_slug.as_bytes()],
        bump,
    )]
    pub pool: Account<'info, BountyPool>,
    #[account(mut)]
    pub journalist: Signer<'info>,
    /// CHECK: The claim_authority's pubkey is recorded into the pool. We don't read its
    /// data; we only constrain that the same pubkey signs claim_bounty later.
    pub claim_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(claim_hash: [u8; 32], beat_slug: String)]
pub struct ClaimBounty<'info> {
    #[account(
        mut,
        seeds = [b"bounty_pool", pool.journalist.as_ref(), beat_slug.as_bytes()],
        bump = pool.bump,
        constraint = pool.active @ LanternError::PoolInactive,
        constraint = pool.claims_paid < pool.max_claims @ LanternError::PoolExhausted,
    )]
    pub pool: Account<'info, BountyPool>,
    #[account(
        init,
        payer = claim_authority,
        space = 8 + 32 + 32 + 8,
        seeds = [b"claim", claim_hash.as_ref()],
        bump,
    )]
    pub receipt: Account<'info, ClaimReceipt>,
    #[account(
        mut,
        constraint = claim_authority.key() == pool.claim_authority @ LanternError::Unauthorized,
    )]
    pub claim_authority: Signer<'info>,
    /// CHECK: Recipient is an ephemeral wallet; the program only credits lamports to it.
    /// The server is the trust anchor — it has already verified that the tip is `closed`
    /// and that the supplied nullifier matches before signing this transaction.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(beat_slug: String)]
pub struct CloseBounty<'info> {
    #[account(
        mut,
        seeds = [b"bounty_pool", journalist.key().as_ref(), beat_slug.as_bytes()],
        bump = pool.bump,
        close = journalist,
        constraint = pool.journalist == journalist.key() @ LanternError::Unauthorized,
    )]
    pub pool: Account<'info, BountyPool>,
    #[account(mut)]
    pub journalist: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(beat_slug: String, additional_claims: u32)]
pub struct TopUpBounty<'info> {
    #[account(
        mut,
        seeds = [b"bounty_pool", journalist.key().as_ref(), beat_slug.as_bytes()],
        bump = pool.bump,
        constraint = pool.journalist == journalist.key() @ LanternError::Unauthorized,
    )]
    pub pool: Account<'info, BountyPool>,
    #[account(mut)]
    pub journalist: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum LanternError {
    #[msg("Claim authority mismatch or unauthorized journalist")]
    Unauthorized,
    #[msg("Pool is no longer active")]
    PoolInactive,
    #[msg("Pool has no claims remaining")]
    PoolExhausted,
    #[msg("Beat slug too long (max 32 bytes)")]
    SlugTooLong,
    #[msg("amount_per_claim must be >= 1_000_000 lamports (0.001 SOL)")]
    AmountTooSmall,
    #[msg("max_claims must be > 0")]
    InvalidMaxClaims,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Pool would fall below rent-exempt minimum after claim")]
    InsufficientPoolBalance,
}
