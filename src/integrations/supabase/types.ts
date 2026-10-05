export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      booking_seats: {
        Row: {
          booking_id: string
          id: string
          price: number
          seat_class: Database["public"]["Enums"]["seat_class"]
          seat_code: string
          show_seat_id: string
        }
        Insert: {
          booking_id: string
          id?: string
          price: number
          seat_class: Database["public"]["Enums"]["seat_class"]
          seat_code: string
          show_seat_id: string
        }
        Update: {
          booking_id?: string
          id?: string
          price?: number
          seat_class?: Database["public"]["Enums"]["seat_class"]
          seat_code?: string
          show_seat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_seats_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_seats_show_seat_id_fkey"
            columns: ["show_seat_id"]
            isOneToOne: false
            referencedRelation: "show_seats"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_snacks: {
        Row: {
          booking_id: string
          id: string
          name: string
          quantity: number
          snack_id: string
          unit_price: number
        }
        Insert: {
          booking_id: string
          id?: string
          name: string
          quantity: number
          snack_id: string
          unit_price: number
        }
        Update: {
          booking_id?: string
          id?: string
          name?: string
          quantity?: number
          snack_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_snacks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_snacks_snack_id_fkey"
            columns: ["snack_id"]
            isOneToOne: false
            referencedRelation: "snacks"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          checked_in_at: string | null
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_ref: string | null
          payment_verified: boolean
          qr_token: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          ref: string
          show_id: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_seats: number
          subtotal_snacks: number
          total: number
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_verified?: boolean
          qr_token?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          ref: string
          show_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_seats?: number
          subtotal_snacks?: number
          total?: number
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_verified?: boolean
          qr_token?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          ref?: string
          show_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_seats?: number
          subtotal_snacks?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      movies: {
        Row: {
          backdrop_url: string | null
          base_price: number
          certification: string | null
          created_at: string
          description: string | null
          duration_min: number
          genre: string
          id: string
          industry: Database["public"]["Enums"]["industry"]
          is_featured: boolean
          language: string
          poster_url: string | null
          rating: number | null
          release_date: string | null
          status: Database["public"]["Enums"]["movie_status"]
          title: string
          tmdb_id: number | null
          trailer_key: string | null
        }
        Insert: {
          backdrop_url?: string | null
          base_price?: number
          certification?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          genre: string
          id?: string
          industry: Database["public"]["Enums"]["industry"]
          is_featured?: boolean
          language: string
          poster_url?: string | null
          rating?: number | null
          release_date?: string | null
          status?: Database["public"]["Enums"]["movie_status"]
          title: string
          tmdb_id?: number | null
          trailer_key?: string | null
        }
        Update: {
          backdrop_url?: string | null
          base_price?: number
          certification?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          genre?: string
          id?: string
          industry?: Database["public"]["Enums"]["industry"]
          is_featured?: boolean
          language?: string
          poster_url?: string | null
          rating?: number | null
          release_date?: string | null
          status?: Database["public"]["Enums"]["movie_status"]
          title?: string
          tmdb_id?: number | null
          trailer_key?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          method: string | null
          notes: Json | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          razorpay_order_id: string
          razorpay_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          notes?: Json | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          notes?: Json | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      screens: {
        Row: {
          created_at: string
          id: string
          name: string
          theater_id: string
          total_seats: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          theater_id: string
          total_seats: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          theater_id?: string
          total_seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "screens_theater_id_fkey"
            columns: ["theater_id"]
            isOneToOne: false
            referencedRelation: "theaters"
            referencedColumns: ["id"]
          },
        ]
      }
      show_seats: {
        Row: {
          booked_by: string | null
          booking_id: string | null
          col_num: number
          created_at: string
          id: string
          is_simulated: boolean
          price: number
          row_letter: string
          row_num: number
          seat_class: Database["public"]["Enums"]["seat_class"]
          seat_code: string
          show_id: string
          status: Database["public"]["Enums"]["seat_status"]
        }
        Insert: {
          booked_by?: string | null
          booking_id?: string | null
          col_num: number
          created_at?: string
          id?: string
          is_simulated?: boolean
          price: number
          row_letter: string
          row_num: number
          seat_class: Database["public"]["Enums"]["seat_class"]
          seat_code: string
          show_id: string
          status?: Database["public"]["Enums"]["seat_status"]
        }
        Update: {
          booked_by?: string | null
          booking_id?: string | null
          col_num?: number
          created_at?: string
          id?: string
          is_simulated?: boolean
          price?: number
          row_letter?: string
          row_num?: number
          seat_class?: Database["public"]["Enums"]["seat_class"]
          seat_code?: string
          show_id?: string
          status?: Database["public"]["Enums"]["seat_status"]
        }
        Relationships: [
          {
            foreignKeyName: "show_seats_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          screen_id: string
          starts_at: string
          theater_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          screen_id: string
          starts_at: string
          theater_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          screen_id?: string
          starts_at?: string
          theater_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_theater_id_fkey"
            columns: ["theater_id"]
            isOneToOne: false
            referencedRelation: "theaters"
            referencedColumns: ["id"]
          },
        ]
      }
      snacks: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      theaters: {
        Row: {
          address: string | null
          city: string
          created_at: string
          id: string
          lat: number
          lon: number
          name: string
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          id?: string
          lat: number
          lon: number
          name: string
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          razorpay_payment_id: string | null
          ref: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          razorpay_payment_id?: string | null
          ref?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          razorpay_payment_id?: string | null
          ref?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_seats: {
        Args: {
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_payment_ref: string
          p_seat_codes: string[]
          p_show_id: string
          p_snacks: Json
          p_wallet_amount: number
        }
        Returns: string
      }
      cancel_booking: { Args: { p_ref: string }; Returns: Json }
      generate_show_seats: {
        Args: { p_base_price: number; p_show_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_ticket: { Args: { p_ref: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sim_seed_all: { Args: never; Returns: number }
      sim_step_all: { Args: never; Returns: number }
      sim_step_show: { Args: { p_show_id: string }; Returns: undefined }
      sim_target_occupancy: { Args: { p_show_id: string }; Returns: number }
      wallet_topup: {
        Args: { p_amount: number; p_ref: string; p_user: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
      booking_status: "confirmed" | "cancelled"
      industry: "Bollywood" | "Hollywood"
      movie_status: "now_showing" | "coming_soon" | "archived"
      payment_method: "wallet" | "card" | "upi"
      payment_purpose: "booking" | "wallet_topup"
      payment_status: "created" | "captured" | "failed" | "cancelled"
      seat_class: "standard" | "executive" | "premium" | "vip"
      seat_status: "available" | "booked"
      txn_type: "credit" | "debit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "user"],
      booking_status: ["confirmed", "cancelled"],
      industry: ["Bollywood", "Hollywood"],
      movie_status: ["now_showing", "coming_soon", "archived"],
      payment_method: ["wallet", "card", "upi"],
      payment_purpose: ["booking", "wallet_topup"],
      payment_status: ["created", "captured", "failed", "cancelled"],
      seat_class: ["standard", "executive", "premium", "vip"],
      seat_status: ["available", "booked"],
      txn_type: ["credit", "debit"],
    },
  },
} as const
