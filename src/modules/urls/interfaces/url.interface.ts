export interface IUrl {
	short_code: string;
	original_url: string;
	user_id?: string;
	created_at: Date;
	expires_at?: Date;
	clicks: number;
	new_url?: string;
}
